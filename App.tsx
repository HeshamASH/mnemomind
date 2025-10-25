import React, { useState, useCallback, useEffect } from 'react';
// Ensure correct imports
import {
    ChatMessage, MessageRole, Source, ElasticResult, Intent, CodeSuggestion,
    ModelId, MODELS, ResponseType, Chat, Theme, Attachment, DataSource, GroundingOptions, DriveFile, EditedFileRecord, GroundingChunk, GeolocationPosition // Added GeolocationPosition and GroundingChunk
} from './types'; // Make sure Chat is imported
import {
    // Keep elasticService imports as they are used
    searchCloudDocuments, getAllCloudFiles, getCloudFileContent,
    createDatasetFromSources, updateFileContent, searchPreloadedDocuments,
    getAllPreloadedFiles, getPreloadedFileContent
} from './services/elasticService';
import {
    streamAiResponse, classifyIntent, streamChitChatResponse,
    streamCodeGenerationResponse, rewriteQuery, getTextFromChunk // Import getTextFromChunk
} from './services/geminiService';
import Header from './components/Header';
import ChatHistory from './components/ChatHistory';
import ChatInterface from './components/ChatInterface';
import FileSearch from './components/FileSearch';
import FileViewer from './components/FileViewer';
import EditedFilesViewer from './components/EditedFilesViewer';
import DiffViewerModal from './components/DiffViewerModal';
import DataSourceModal from './components/DataSourceModal';
import ErrorBoundary from './components/ErrorBoundary';
import { reciprocalRankFusion } from './utils/rrf';
// Import the new ChunkViewerModal
import ChunkViewerModal from './components/ChunkViewerModal';


const HISTORY_KEY = 'elastic-codemind-state';
// Expanded list of potentially editable text-based extensions
const EDITABLE_EXTENSIONS = [
    // Code
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb',
    'rs', 'swift', 'kt', 'kts', 'dart', 'sh', 'bash', 'zsh',
    // Markup/Data
    'html', 'xml', 'json', 'yaml', 'yml', 'md', 'csv', 'ini', 'toml', 'sql',
    // Config/Text
    'txt', 'cfg', 'conf', 'gitignore', 'dockerfile', 'properties',
    // Styles
    'css', 'scss', 'less', 'sass'
];


// Interface moved from App.tsx scope for potential reuse if needed elsewhere
// Or keep it inside App if only used there
// export interface EditedFileRecord {
//   file: Source;
//   originalContent: string;
//   currentContent: string;
// }

const App: React.FC = () => {
  // --- State Variables ---
  const [theme, setTheme] = useState < Theme > (() => { /* ... keep as is ... */ if (typeof window !== 'undefined' && window.localStorage) { const storedTheme = window.localStorage.getItem('theme') as Theme; return storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } return 'light'; });
  const [chats, setChats] = useState < Chat[] > ([]);
  const [activeChatId, setActiveChatId] = useState < string | null > (null);
  const [isLoading, setIsLoading] = useState < boolean > (false);
  const [allFiles, setAllFiles] = useState < Source[] > ([]); // Combined list for file browser
  const [isFileSearchVisible, setIsFileSearchVisible] = useState < boolean > (false);
  const [isEditedFilesVisible, setIsEditedFilesVisible] = useState < boolean > (false);
  const [isDataSourceModalVisible, setIsDataSourceModalVisible] = useState < boolean > (false);
  const [editedFiles, setEditedFiles] = useState < Map < string,
    EditedFileRecord >> (new Map());
  const [selectedFile, setSelectedFile] = useState < Source | null > (null); // For FileViewer
  const [selectedFileContent, setSelectedFileContent] = useState < string > (''); // For FileViewer
  const [selectedModel, setSelectedModel] = useState < ModelId > (ModelId.GEMINI_FLASH_LITE);
  const [diffViewerRecord, setDiffViewerRecord] = useState < EditedFileRecord | null > (null); // For DiffViewer
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Chat history sidebar
  const [isCodeGenerationEnabled, setIsCodeGenerationEnabled] = useState < boolean > (false); // Default to false
  const [apiError, setApiError] = useState < string | null > (null); // General API errors
  const [cloudSearchError, setCloudSearchError] = useState < string | null > (null); // Specific cloud search errors
  const [location, setLocation] = useState < GeolocationPosition | null > (null); // User location for Maps
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState < boolean > (false); // For Drive connection flow
  // State for the ChunkViewerModal
  const [selectedChunkResult, setSelectedChunkResult] = useState < ElasticResult | null > (null);


  // --- Derived State ---
  const activeChat = chats.find(c => c.id === activeChatId);


  // --- Callbacks for State Updates ---
  const updateActiveChat = useCallback((updater: (chat: Chat) => Chat) => {
    setChats(prevChats => prevChats.map(chat =>
      chat.id === activeChatId ? updater(chat) : chat
    ));
  }, [activeChatId]);

  const addMessageToActiveChat = useCallback((message: ChatMessage) => {
     // Ensure message has elasticSources initialized if it's a model message
     const messageToAdd = message.role === MessageRole.MODEL
        ? { elasticSources: [], groundingChunks: [], ...message } // Default elasticSources/groundingChunks
        : message;
     updateActiveChat(chat => ({
        ...chat,
        messages: [...(chat.messages || []), messageToAdd] // Ensure messages array exists
     }));
  }, [updateActiveChat]);


  const updateLastMessageInActiveChat = useCallback((updater: (message: ChatMessage) => ChatMessage) => {
    updateActiveChat(chat => {
        if (!chat.messages || chat.messages.length === 0) return chat; // Guard clause
        return {
            ...chat,
            messages: chat.messages.map((msg, index) =>
                index === chat.messages.length - 1 ? updater(msg) : msg
            )
        };
    });
  }, [updateActiveChat]);


  // --- Handlers ---

  // Create a new chat session
  const handleNewChat = useCallback(() => {
    const newChat: Chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // More unique ID
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      dataSource: null, // No data source initially
      dataset: [],      // Empty client-side dataset
      groundingOptions: { // Default grounding options
        useCloud: true, // Default to cloud if available
        usePreloaded: false,
        useGoogleSearch: false,
        useGoogleMaps: false,
      },
    };
    // Add new chat and sort by creation date descending
    setChats(prev => [newChat, ...prev].sort((a, b) => b.createdAt - a.createdAt));
    setActiveChatId(newChat.id);
    setEditedFiles(new Map()); // Clear edits for new chat
    setCloudSearchError(null); // Clear cloud errors
    setIsCodeGenerationEnabled(false); // Reset code gen toggle
    // Close any open modals/side panels
    setSelectedFile(null);
    setSelectedChunkResult(null);
    setDiffViewerRecord(null);
    setIsFileSearchVisible(false);
    setIsEditedFilesVisible(false);
    setIsDataSourceModalVisible(false);
  }, []); // Empty dependency array


   // --- Effects ---

  // Load state from localStorage on mount
  useEffect(() => {
     try {
         const savedState = localStorage.getItem(HISTORY_KEY);
         if (savedState) {
             const { chats: savedChats, activeChatId: savedActiveChatId, model: savedModel } = JSON.parse(savedState);

             // Restore chats, ensuring groundingOptions exist and default correctly
             const restoredChats = (savedChats || []).map((chat: any) => {
                 const defaultGrounding = { useCloud: true, usePreloaded: false, useGoogleSearch: false, useGoogleMaps: false };
                 const groundingOptions = chat.groundingOptions && typeof chat.groundingOptions === 'object'
                     ? { ...defaultGrounding, ...chat.groundingOptions }
                     : defaultGrounding;

                 // Ensure messages have elasticSources
                 const messages = (chat.messages || []).map((msg: ChatMessage) => ({
                     elasticSources: [], // Add default empty array
                     groundingChunks: [], // Add default empty array
                     ...msg
                 }));


                 return {
                     ...chat,
                     messages: messages, // Use messages with default elasticSources
                     dataset: chat.dataset || [], // Ensure dataset array exists
                     groundingOptions: groundingOptions // Use merged/defaulted options
                 };
             }).sort((a: Chat, b: Chat) => b.createdAt - a.createdAt); // Sort by date

             setChats(restoredChats);
             setSelectedModel(savedModel || ModelId.GEMINI_FLASH_LITE); // Restore model or use default

             // Validate and set activeChatId
             if (savedActiveChatId && restoredChats.some((c: Chat) => c.id === savedActiveChatId)) {
                 setActiveChatId(savedActiveChatId);
             } else if (restoredChats.length > 0) {
                 setActiveChatId(restoredChats[0].id); // Fallback to the latest chat
             } else {
                 handleNewChat(); // Create a new chat if none were restored
             }
         } else {
             handleNewChat(); // Create a new chat if no saved state exists
         }
     } catch (error) {
         console.error("Failed to parse state from localStorage", error);
         localStorage.removeItem(HISTORY_KEY); // Clear potentially corrupted state
         handleNewChat(); // Start fresh
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNewChat]); // handleNewChat is memoized and stable


  // Save state to localStorage on change
  useEffect(() => {
     try {
         // Only save if there are chats and an active chat is selected
         if (chats.length > 0 && activeChatId) {
             const stateToSave = JSON.stringify({ chats, activeChatId, model: selectedModel });
             localStorage.setItem(HISTORY_KEY, stateToSave);
         } else if (chats.length === 0) {
              // Clear storage if all chats are deleted
             localStorage.removeItem(HISTORY_KEY);
         }
     } catch (error) {
         console.error("Failed to save state to localStorage", error);
         // Consider notifying the user if saving persistently fails
     }
  }, [chats, activeChatId, selectedModel]); // Rerun whenever these change


  // Apply theme class
  useEffect(() => {
    // Determine the theme to apply
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveTheme = theme || (systemPrefersDark ? 'dark' : 'light');

    // Apply class to the root element
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(effectiveTheme);

    // Save the explicit theme choice (or clear if it matches system preference implicitly)
    if (theme) { // Only save if a theme was explicitly set
        localStorage.setItem('theme', theme);
    } else {
        localStorage.removeItem('theme'); // Or set to 'system'
    }
  }, [theme]); // Rerun only when the theme state changes


  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Geolocation acquired:", position);
                setLocation(position);
            },
            (error) => {
                // Log different levels of warning based on error type
                if (error.code === error.PERMISSION_DENIED) {
                    console.info("Geolocation permission denied by user."); // Less alarming
                } else {
                    console.warn(`Geolocation error (${error.code}): ${error.message}. Maps grounding may be less effective.`);
                }
                 setLocation(null); // Ensure location is null on error
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 } // Options
        );
    } else {
        console.warn("Geolocation is not supported by this browser.");
    }
  }, []); // Runs once on mount


  // Handle Google Drive callback URL cleanup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'google-drive') {
        setIsDataSourceModalVisible(true);
        setShowGoogleDrivePicker(true);
        // Clean the URL history state after processing the parameter
        const cleanUrl = window.location.pathname; // Get path without query params
        window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []); // Runs once on mount


  // Fetch file list based on active chat and grounding options
  useEffect(() => {
    const fetchFiles = async () => {
        // Use optional chaining for safer access
        if (!activeChat?.groundingOptions) {
            setAllFiles([]);
            setCloudSearchError(null); // Clear error if no chat active
            return;
        }

        const currentGroundingOptions = activeChat.groundingOptions; // Use options from the current chat
        let combinedFiles: Source[] = [];
        let cloudErrorOccurred = false;

        // Fetch preloaded files if enabled and available
        if (currentGroundingOptions.usePreloaded && activeChat.dataset?.length > 0) { // Check dataset length
            const preloaded = getAllPreloadedFiles(activeChat.dataset);
            combinedFiles.push(...preloaded);
            // console.log(`Fetched ${preloaded.length} preloaded files.`);
        }

        // Fetch cloud files if enabled
        if (currentGroundingOptions.useCloud) {
            try {
                setCloudSearchError(null); // Reset error before fetch
                const cloudFiles = await getAllCloudFiles();
                combinedFiles.push(...cloudFiles);
                // console.log(`Fetched ${cloudFiles.length} cloud files.`);
            } catch (error) {
                console.error("Error fetching cloud files:", error);
                const errorMessage = error instanceof Error ? error.message : "Failed to fetch cloud files.";
                setCloudSearchError(errorMessage);
                cloudErrorOccurred = true; // Mark that cloud fetch failed
            }
        } else if (!cloudErrorOccurred) {
             // Explicitly clear cloud error only if cloud is disabled AND no error occurred previously in this run
             setCloudSearchError(null);
        }

        // Deduplicate files based on ID - cloud might override local if IDs clash intentionally
        const uniqueFiles = Array.from(new Map(combinedFiles.map(file => [file.id, file])).values());

        // Sort files: folders first, then files, alphabetically within each group
        uniqueFiles.sort((a, b) => {
            const aIsDir = !a.fileName?.includes('.'); // Simple dir check, use optional chaining
            const bIsDir = !b.fileName?.includes('.');
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1; // Folders first
            // Sort by full path to group items within the same directory
            const aFullPath = a.path ? `${a.path}/${a.fileName}` : a.fileName || ''; // Handle missing filename
            const bFullPath = b.path ? `${b.path}/${b.fileName}` : b.fileName || '';
            return aFullPath.localeCompare(bFullPath); // Then sort alphabetically by path
        });


        setAllFiles(uniqueFiles);
        // console.log(`Set ${uniqueFiles.length} unique, sorted files for the browser.`);
    };

    fetchFiles();

  // Depend on activeChat directly - includes dataset and groundingOptions changes
  // Also depend on activeChatId to refetch when switching chats explicitly
  }, [activeChatId, activeChat?.dataset, activeChat?.groundingOptions]);


  // --- Core Logic ---

  // Fetch combined search results
  const searchElastic = async (query: string): Promise<ElasticResult[]> => {
    if (!activeChat?.groundingOptions) return [];

    setCloudSearchError(null);
    const searchPromises: Promise<ElasticResult[]>[] = [];
    const { useCloud, usePreloaded } = activeChat.groundingOptions;

    if (useCloud) {
        searchPromises.push(
            searchCloudDocuments(query).catch(err => {
                console.error("Cloud search failed:", err);
                setCloudSearchError(err instanceof Error ? err.message : "Failed to fetch from cloud.");
                return [];
            })
        );
    }

    if (usePreloaded && activeChat.dataset?.length > 0) {
        searchPromises.push(Promise.resolve(searchPreloadedDocuments(query, activeChat.dataset)));
    }

    if (searchPromises.length === 0) return [];

    try {
        const searchResultsArrays = await Promise.all(searchPromises);
        const fusedResults = reciprocalRankFusion(searchResultsArrays);
        return fusedResults.slice(0, 10);
    } catch (error) {
        console.error("Error during search result fusion:", error);
        return [];
    }
  };


  // Get content for a specific file (handles local vs. cloud/drive)
  const getFileContent = useCallback(async (source: Source): Promise<string | null> => {
      console.log(`[App] Getting content for: ${source.fileName} (ID: ${source.id})`);
      if (!activeChat) {
          console.warn("getFileContent called with no active chat.");
          setApiError("Cannot load file content: No active chat found.");
          return null;
      }
      setApiError(null); // Clear previous API error

      // 1. Check if it's a locally stored file (from folder/file upload dataset)
      // Use a more reliable check based on ID structure or existence in dataset
      const isLocalFile = activeChat.dataset?.some(d => d.source.id === source.id);

      if (isLocalFile && activeChat.dataset) {
          console.log(`[App] Fetching local content for ID: ${source.id}`);
          const content = getPreloadedFileContent(source, activeChat.dataset);
          if (content === null) {
              const errorMsg = `Content not found in local dataset for ${source.fileName} (ID: ${source.id}).`;
              console.error(errorMsg);
              // Return error string instead of setting global state
              return `Error: ${errorMsg}`;
          }
          return content; // Return content or null
      }

      // 2. Check if it's a Google Drive file
      if (activeChat.dataSource?.type === 'drive') {
          console.log(`[App] Fetching Google Drive content for ID: ${source.id}`);
          try {
              const response = await fetch(`/api/drive/files/${source.id}`); // Assuming API route exists
              if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`Google Drive API Error (${response.status}): ${errorText || response.statusText}`);
              }
              const data = await response.json();
              if (data.content === undefined || data.content === null) {
                   throw new Error("API response for Drive file is missing 'content' field.");
              }
              // Backend should ideally return base64 for PDFs, text/csv for others
              return data.content;
          } catch (error) {
              console.error("Google Drive fetch error:", error);
              const errorMsg = error instanceof Error ? error.message : 'Could not load Google Drive file content.';
              // setApiError(errorMsg);
              return `Error: ${errorMsg}`; // Return error message string
          }
      }

      // 3. Otherwise, assume it's from Elasticsearch Cloud
      console.log(`[App] Fetching cloud content for ID: ${source.id}`);
      try {
          // getCloudFileContent should return the raw content (text or base64 string) or an error string
          const cloudContent = await getCloudFileContent(source);
           // If the service indicates an error (returns error string or null), pass it through
           if (cloudContent === null || cloudContent.startsWith("Error:")) {
               const errorMsg = cloudContent || "Failed to load cloud content.";
               console.error(`Error from getCloudFileContent: ${errorMsg}`);
               // setApiError(errorMsg); // Avoid setting global error for individual file load failure
               return errorMsg; // Return the error message string
           }
          return cloudContent; // Return successful content
      } catch (error) {
          // Catch unexpected errors during the fetch process itself
          console.error("Cloud content fetch exception:", error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error fetching cloud content.';
          // setApiError(errorMsg);
          return `Error: ${errorMsg}`; // Return error message string
      }
  // Depend on specific properties if possible, or activeChatId if simpler
  }, [activeChatId, activeChat?.dataSource, activeChat?.dataset]); // Re-check dependencies


  // --- RAG Query Handling ---
  const handleQueryDocuments = async (currentMessages: ChatMessage[]) => {
    if (!activeChat?.groundingOptions) { // Ensure activeChat & options exist
        console.error("handleQueryDocuments called without active chat or grounding options.");
        addMessageToActiveChat({ // Add error message to UI
             role: MessageRole.MODEL,
             content: "Error: Cannot process query - chat session not properly initialized.",
             responseType: ResponseType.ERROR,
             modelId: selectedModel
        });
        return;
    }

    const latestUserMessage = currentMessages[currentMessages.length - 1];
    if (!latestUserMessage) return; // Should not happen if currentMessages is populated

    const currentGroundingOptions = activeChat.groundingOptions; // Use options from current chat

    // Add placeholder message
    const modelMessagePlaceholder: ChatMessage = {
      role: MessageRole.MODEL,
      content: '', // Start empty
      elasticSources: [], // Initialize as empty array
      groundingChunks: [], // Initialize as empty array
      responseType: ResponseType.RAG, // Tentative type
      modelId: selectedModel
    };
    addMessageToActiveChat(modelMessagePlaceholder);

    // Rewrite query if needed (e.g., for cloud search or web search)
    let queryToUse = latestUserMessage.content;
    const needsRewrite = currentGroundingOptions.useCloud || currentGroundingOptions.useGoogleSearch || currentGroundingOptions.useGoogleMaps;
    if (needsRewrite && queryToUse.trim().length > 3) { // Avoid rewriting trivial queries
        try {
            const modelToUseForRewrite = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model; // Use selected model if possible
            queryToUse = await rewriteQuery(latestUserMessage.content, modelToUseForRewrite);
            console.log("Rewritten Query:", queryToUse);
        } catch (rewriteError) {
             console.error("Query rewrite failed:", rewriteError);
             // Proceed with the original query if rewrite fails
        }
    }

    // Perform search (Elastic/Preloaded)
    let elasticResults: ElasticResult[] = [];
    if (currentGroundingOptions.useCloud || currentGroundingOptions.usePreloaded) {
      elasticResults = await searchElastic(queryToUse); // searchElastic handles errors internally now
      console.log("Elastic/Preloaded Results Found:", elasticResults.length);
      // Update placeholder with sources immediately, even if empty
      updateLastMessageInActiveChat(msg => ({ ...msg, elasticSources: elasticResults }));
    }

    // --- Fallback to Google Search/Maps Logic ---
    const shouldUseGroundingFallback = elasticResults.length === 0 && (currentGroundingOptions.useGoogleSearch || currentGroundingOptions.useGoogleMaps);

    if (shouldUseGroundingFallback) {
        console.log("No Elastic/Preloaded results, attempting Gemini Grounding (Search/Maps)");
        // Determine primary grounding type for metadata display
        const groundingType = currentGroundingOptions.useGoogleMaps ? ResponseType.GOOGLE_MAPS : ResponseType.GOOGLE_SEARCH;
        updateLastMessageInActiveChat(msg => ({ ...msg, responseType: groundingType }));

        try {
            const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
            // Pass empty context `[]` but enable grounding in options passed to the service
            const responseStream = await streamAiResponse(
                currentMessages,
                [], // Empty context for API grounding
                modelToUse,
                currentGroundingOptions, // Pass the enabled options
                location // Pass location
            );

            let accumulatedContent = '';
            let allGroundingAttributions: any[] = []; // Store raw attributions

            // **FIXED: Correctly iterate over the async generator**
            for await (const chunk of responseStream) {
                 // **FIXED: Use getTextFromChunk helper**
                 const chunkText = getTextFromChunk(chunk);
                 accumulatedContent += chunkText;
                 updateLastMessageInActiveChat(msg => ({ ...msg, content: accumulatedContent }));

                // Safely access grounding/citation metadata and attributions
                const candidateAny = (chunk as any)?.candidates?.[0];

                // **Refined: Check multiple possible locations for grounding data**
                const newAttributions =
                    candidateAny?.groundingMetadata?.groundingAttributions || // Preferred structure
                    candidateAny?.groundingMetadata?.webSearchQueries?.length > 0 ? candidateAny?.groundingMetadata?.groundingAttributions : undefined || // Check if search was used
                    candidateAny?.citationMetadata?.citationSources; // Older structure

                if (Array.isArray(newAttributions) && newAttributions.length > 0) {
                    allGroundingAttributions.push(...newAttributions);
                    console.log("Received grounding attributions:", newAttributions); // Log received data
                }
            }

             // Process and store unique grounding chunks AFTER stream finishes
             const uniqueAttributions = Array.from(new Map(
                allGroundingAttributions
                  // **FIXED: Adapt to citationSources structure if needed**
                  .filter((attr: any) => attr?.uri || attr.web?.uri || attr.maps?.uri)
                  .map((attr: any) => [attr.uri || attr.web?.uri || attr.maps?.uri, attr]) // Use URI as key
             ).values());

             // Map valid attributions to our GroundingChunk format
             const finalGroundingChunks: GroundingChunk[] = uniqueAttributions
               .map((attr: any) => ({
                 // **FIXED: Handle both `web` object and direct `uri`/`title`**
                 web: attr.web
                   ? { uri: attr.web.uri, title: attr.web.title || '' }
                   : attr.uri // Check for direct uri/title (from citationSources)
                     ? { uri: attr.uri, title: attr.title || '' }
                     : undefined,
                 maps: attr.maps ? { uri: attr.maps.uri, title: attr.maps.title || '' } : undefined,
                 // Add other types here if needed (e.g., shopping)
               }))
               .filter(chunk => chunk.web || chunk.maps); // Ensure at least one type is present

            console.log("Final unique grounding chunks:", finalGroundingChunks); // Log processed data
            updateLastMessageInActiveChat(msg => ({ ...msg, groundingChunks: finalGroundingChunks }));

        } catch (groundingError: unknown) {
            console.error("Error during Gemini grounding fallback:", groundingError);
            let errorMsg = "Sorry, I couldn't find information in the documents and an external search failed. Please try again.";
            // **FIXED: Check specific error for safety filter**
            if (groundingError instanceof Error && groundingError.message === "BlockedBySafetyFilter") {
                 errorMsg = "I'm sorry, but I can't provide a response to that. The request was blocked by the safety filter. Please try rephrasing your message.";
            } else if (groundingError instanceof Error) {
                errorMsg = `An error occurred during the external search: ${groundingError.message}`;
            }
            updateLastMessageInActiveChat(msg => ({
               ...msg,
               content: errorMsg,
               responseType: ResponseType.ERROR
            }));
        }
        return; // Stop processing after grounding fallback
    }

    // --- Handle No Results from Any Source ---
    if (elasticResults.length === 0 && !shouldUseGroundingFallback) {
        console.log("No results from Elastic/Preloaded, and grounding fallback not enabled/applicable.");
        updateLastMessageInActiveChat(msg => ({
            ...msg,
            content: "I couldn't find any relevant information in the available documents to answer your question.",
            responseType: ResponseType.ERROR // Indicate no answer found
         }));
         return;
    }

    // --- Generate Response based on Elastic/Preloaded Results ---
    if (elasticResults.length > 0) {
        console.log("Generating response based on Elastic/Preloaded context.");
        updateLastMessageInActiveChat(msg => ({ ...msg, responseType: ResponseType.RAG })); // Confirm RAG type

        try {
            const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
            // Pass elasticResults as context, explicitly disable API grounding for this call
            const apiGroundingOptions = { ...currentGroundingOptions, useGoogleSearch: false, useGoogleMaps: false };
            const responseStream = await streamAiResponse(currentMessages, elasticResults, modelToUse, apiGroundingOptions, location); // Pass location

            let accumulatedContent = '';
            // **FIXED: Correctly iterate over the async generator**
            for await (const chunk of responseStream) {
                 // **FIXED: Use getTextFromChunk helper**
                const chunkText = getTextFromChunk(chunk);
                accumulatedContent += chunkText;
                updateLastMessageInActiveChat(msg => ({ ...msg, content: accumulatedContent }));
            }
            // Optional: Final update in case the stream closes before the last chunk renders
            // updateLastMessageInActiveChat(msg => ({ ...msg, content: accumulatedContent }));

        } catch (ragError: unknown) {
            console.error("Error during RAG generation:", ragError);
            let errorMsg = "Sorry, I found relevant documents but couldn't generate an answer. Please try again.";
            // **FIXED: Check specific error for safety filter**
            if (ragError instanceof Error && ragError.message === "BlockedBySafetyFilter") {
                errorMsg = "I'm sorry, but I can't provide a response based on the provided documents. The request was blocked by the safety filter. Please try a different query.";
            } else if (ragError instanceof Error) {
                errorMsg = `An error occurred during answer generation: ${ragError.message}`;
            }
            updateLastMessageInActiveChat(msg => ({
               ...msg,
               content: errorMsg,
               responseType: ResponseType.ERROR
            }));
        }
    }
    // If elasticResults was empty, the earlier checks should have already handled the response.
  };


  // Handle pure conversational messages
  const handleChitChat = async (currentMessages: ChatMessage[]) => {
    // Add placeholder immediately
    addMessageToActiveChat({
        role: MessageRole.MODEL,
        content: '', // Start empty
        responseType: ResponseType.CHIT_CHAT,
        modelId: selectedModel
    });
    try {
        const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
        const responseStream = await streamChitChatResponse(currentMessages, modelToUse);
        let accumulatedContent = '';
        // **FIXED: Correctly iterate over the async generator**
        for await (const chunk of responseStream) {
             // **FIXED: Use getTextFromChunk helper**
            const chunkText = getTextFromChunk(chunk);
            accumulatedContent += chunkText;
            // Update the last message (the placeholder) incrementally
            updateLastMessageInActiveChat(msg => ({ ...msg, content: accumulatedContent }));
        }
        // Optional final update, might be redundant
        // updateLastMessageInActiveChat(msg => ({ ...msg, content: accumulatedContent }));
    } catch (error: unknown) {
        console.error('ChitChat Error:', error);
        let errorMsg = "Sorry, I couldn't get a response. Please try again.";
         // **FIXED: Check specific error for safety filter**
         if (error instanceof Error && error.message.includes('SAFETY')) { // Simple check
            errorMsg = "I'm sorry, but I can't provide a response to that. The request was blocked by the safety filter. Please try rephrasing your message.";
        } else if (error instanceof Error) {
            errorMsg = `An error occurred: ${error.message}`;
        }
        // Update the placeholder message with the appropriate error
        updateLastMessageInActiveChat(msg => ({
            ...msg,
            content: errorMsg,
            responseType: ResponseType.ERROR // Mark as error
        }));
    }
  };


  // Handle code generation/editing requests
  const handleCodeGeneration = async (currentMessages: ChatMessage[]) => {
    if (!activeChat) { console.error("handleCodeGeneration: No active chat."); return; }

    // Add placeholder
    addMessageToActiveChat({
        role: MessageRole.MODEL, content: 'Analyzing request and searching relevant files...', // Initial thinking message
        responseType: ResponseType.CODE_GENERATION, modelId: selectedModel
    });

    try {
        const latestQuery = currentMessages[currentMessages.length - 1]?.content;
        if (!latestQuery) throw new Error("Cannot generate code without a user query.");

        // Search for relevant files (using Elastic/Preloaded)
        const searchResults = await searchElastic(latestQuery);

        // Filter for editable files based on extension
        const editableSearchResults = searchResults.filter(r => {
            const extension = r.source?.fileName?.split('.').pop()?.toLowerCase();
            return extension && EDITABLE_EXTENSIONS.includes(extension);
        });

        if (editableSearchResults.length === 0) {
            updateLastMessageInActiveChat(msg => ({ ...msg, content: "I couldn't find any relevant editable files (like code, markdown, txt) based on your request. I can only suggest edits for text-based files." }));
            return;
        }

        // Inform user which file is being considered (e.g., the top result)
        const targetFileSource = editableSearchResults[0].source; // Focus on the top result
        updateLastMessageInActiveChat(msg => ({ ...msg, content: `Found relevant files. Considering edits for \`${targetFileSource.fileName}\`...` }));

        const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
        // Generate the code suggestion stream
        const responseStream = await streamCodeGenerationResponse(currentMessages, editableSearchResults, modelToUse);

        let responseJsonText = '';
        let streamFinished = false;
        try {
            // **FIXED: Correctly iterate over the async generator**
            for await (const chunk of responseStream) {
                // **FIXED: Use getTextFromChunk helper**
                const chunkText = getTextFromChunk(chunk);
                responseJsonText += chunkText;
            }
            streamFinished = true;
        } catch (streamError: unknown) {
             console.error("Error reading code generation stream:", streamError);
             let errorMsg = "An error occurred while receiving the code suggestion. Please try again.";
              // **FIXED: Check specific error for safety filter**
             if (streamError instanceof Error && streamError.message.includes('SAFETY')) { // Simple check
                 errorMsg = "I'm sorry, but I can't generate a code suggestion for that. The request was blocked by the safety filter. Please try rephrasing your request.";
             } else if (streamError instanceof Error) {
                 errorMsg = `An error occurred while generating the code: ${streamError.message}`;
             }
             updateLastMessageInActiveChat(msg => ({ ...msg, content: errorMsg, responseType: ResponseType.ERROR }));
             return; // Stop processing if stream fails
        }


        if (!streamFinished && !responseJsonText) { // Check if stream finished AND we got some text
            console.warn("Code generation stream did not finish cleanly or returned empty.");
             updateLastMessageInActiveChat(msg => ({ ...msg, content: `The code generation response was incomplete or empty.`}));
             return; // Stop processing
        }

        let suggestion: CodeSuggestion | null = null;
        let errorMessage: string | null = null;

        try {
            // Attempt to parse the potentially incomplete/complete JSON
            const responseObject = JSON.parse(responseJsonText);

            if (responseObject.error) {
                errorMessage = responseObject.error;
            } else if (responseObject.filePath && responseObject.newContent && responseObject.thought) {
                const fullPath = responseObject.filePath;
                // Find the file in *all* available files (cloud + local)
                const file = allFiles.find(f => (f.path ? `${f.path}/${f.fileName}` : f.fileName || '') === fullPath); // Handle missing filename

                if (!file) {
                    errorMessage = `The model suggested editing a file path I couldn't match: \`${fullPath}\`. Please check the path relative to your data source.`;
                } else {
                    // Fetch original content (crucially, handles local vs cloud/drive)
                    const originalContent = await getFileContent(file);

                    if (originalContent === null || originalContent.startsWith("Error:")) { // Check for error string
                        errorMessage = `Could not fetch the original content for \`${file.fileName}\` to create the suggestion. ${originalContent || ''}`;
                    } else {
                        // Successfully created suggestion
                        suggestion = {
                            file,
                            thought: responseObject.thought,
                            originalContent,
                            suggestedContent: responseObject.newContent,
                            status: 'pending',
                        };
                    }
                }
            } else {
                errorMessage = "The AI response for the code edit was incomplete or malformed. Missing required fields.";
                console.warn("Malformed JSON response:", responseJsonText); // Log malformed JSON
            }
        } catch (e) {
            console.error("Code generation JSON parsing error:", e, "Raw response:", responseJsonText);
            errorMessage = `Sorry, I couldn't process the code generation response. It might be malformed. ${e instanceof Error ? e.message : ''}`;
        }

        // Update the final message with suggestion or error
        if (suggestion) {
            updateLastMessageInActiveChat(msg => ({
                ...msg,
                content: `I have a suggestion for \`file:${suggestion.file.fileName}\`:`, // Use backticks for file mention
                suggestion // Attach the suggestion object
            }));
        } else {
            updateLastMessageInActiveChat(msg => ({
                ...msg,
                content: errorMessage || "Sorry, I couldn't generate the code edit.",
                responseType: ResponseType.ERROR
            }));
        }

    } catch (error) { // Catch errors from searchElastic or initial setup
        console.error('Code Generation Main Error:', error);
        const errorMsg = error instanceof Error ? error.message : "Failed to prepare code generation.";
        // Update the placeholder with the error
        updateLastMessageInActiveChat(msg => ({
            ...msg,
            content: `Sorry, an error occurred preparing the code generation: ${errorMsg}`,
            responseType: ResponseType.ERROR
        }));
    }
  };


  // Main message sending handler
  const handleSendMessage = useCallback(async (query: string, attachment?: Attachment) => {
    // Basic validation
    if ((!query.trim() && !attachment) || isLoading || !activeChat?.groundingOptions) {
        console.warn("Send message aborted:", { query, attachment, isLoading, activeChat });
        if (!activeChat) setApiError("Cannot send message: No active chat selected.");
        else if (!activeChat.groundingOptions) setApiError("Cannot send message: Chat grounding options missing.");
        return;
    }

    setIsLoading(true);
    setApiError(null); // Clear previous errors

    const userMessage: ChatMessage = { role: MessageRole.USER, content: query, attachment };

    // Determine new title only if it's the very first message
    const newTitle = (!activeChat.messages?.length && query.trim()) // Check messages length
        ? query.substring(0, 40) + (query.length > 40 ? '...' : '')
        : activeChat.title;

    // Add user message to the active chat
    updateActiveChat(chat => ({
      ...chat,
      messages: [...(chat.messages || []), userMessage], // Ensure messages array exists
      title: newTitle // Update title conditionally
    }));

    // --- Get messages *after* adding the user message for context ---
    // A bit tricky due to state update timing, let's construct the context manually
    const currentMessagesContext = [...(activeChat.messages || []), userMessage];

    try {
      const currentGroundingOptions = activeChat.groundingOptions; // Use options from this chat
      const { useCloud, usePreloaded, useGoogleSearch, useGoogleMaps } = currentGroundingOptions;
      // Determine if any grounding source is active (including web/maps)
      const isGrounded = useCloud || usePreloaded || useGoogleSearch || useGoogleMaps;

      // --- Intent Classification and Routing ---
      if (isGrounded || attachment) {
          const modelToUseForIntent = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model; // Use selected or default
          let intent = Intent.QUERY_DOCUMENTS; // Default intent if classification fails or isn't needed
          try {
             // Only classify if there's text query (skip for just attachment)
             if (query.trim()) {
                intent = await classifyIntent(query, modelToUseForIntent);
                console.log("Classified Intent:", intent);
             } else if (attachment) {
                // If only attachment, assume query intent
                intent = Intent.QUERY_DOCUMENTS;
                console.log("Attachment only, assuming Intent:", intent);
             }
          } catch(intentError) {
             console.error("Intent classification failed:", intentError);
             // Proceed with default intent (query_documents)
             setApiError(`Intent classification failed: ${intentError instanceof Error ? intentError.message: 'Unknown error'}`);
          }

          // Route based on intent
          if (intent === Intent.GENERATE_CODE && isCodeGenerationEnabled) {
              await handleCodeGeneration(currentMessagesContext);
          } else if (intent === Intent.CHIT_CHAT && !attachment) { // Don't chit-chat if there's an attachment
              // Only use web search for chit-chat if ONLY web search is enabled (rare case)
              if (useGoogleSearch && !useCloud && !usePreloaded && !useGoogleMaps) {
                 await handleQueryDocuments(currentMessagesContext); // Treat as query if only web search is on
              } else {
                 await handleChitChat(currentMessagesContext); // Normal chit-chat
              }
          } else {
              // Default: QUERY_DOCUMENTS or GENERATE_CODE (when disabled) or UNKNOWN
              await handleQueryDocuments(currentMessagesContext);
          }
      } else {
        // No grounding sources enabled AND no attachment, definitely treat as chit-chat
        await handleChitChat(currentMessagesContext);
      }
    } catch (error) {
      console.error('Error processing message in handleSendMessage:', error);
      const errorMessageContent = error instanceof Error ? error.message : "An unknown error occurred.";
      // Add error message to chat
       addMessageToActiveChat({
           role: MessageRole.MODEL,
           content: `Sorry, I encountered an error: ${errorMessageContent}`,
           responseType: ResponseType.ERROR, // Mark as error type
           modelId: selectedModel
       });
       setApiError(`Error: ${errorMessageContent}`); // Show in the persistent error display
    } finally {
      setIsLoading(false);
    }
  // Include all dependencies that the callback relies on
  }, [isLoading, activeChat, selectedModel, isCodeGenerationEnabled, updateActiveChat, addMessageToActiveChat, location, allFiles, getFileContent, handleNewChat, setApiError]); // Added setApiError


  // Connect local files/folder
  const handleConnectDataSource = useCallback(async (files: File[], dataSource: DataSource) => {
    console.log("handleConnectDataSource: files", files.length, "Type:", dataSource.type);
    setIsLoading(true);
    setIsDataSourceModalVisible(false);
    setApiError(null);
    try {
        const newDataset = await createDatasetFromSources(files);
        console.log(`handleConnectDataSource: Dataset created with ${newDataset.length} entries.`);
        const newChat: Chat = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: dataSource.name, messages: [], createdAt: Date.now(), dataSource, dataset: newDataset,
            groundingOptions: { useCloud: false, usePreloaded: true, useGoogleSearch: false, useGoogleMaps: false }, // Default for local
        };
        setChats(prev => [newChat, ...prev].sort((a,b)=> b.createdAt - a.createdAt));
        setActiveChatId(newChat.id);
        setEditedFiles(new Map());
        setCloudSearchError(null);
    } catch (error) {
        console.error("Error processing data source:", error);
        setApiError(error instanceof Error ? error.message : "Error processing files.");
    } finally {
        setIsLoading(false);
    }
  }, []); // Empty dependency array


  // Connect Google Drive files
  const handleConnectGoogleDrive = useCallback(async (driveFiles: DriveFile[], dataSource: DataSource) => {
    setIsLoading(true); // Set loading while processing
    setIsDataSourceModalVisible(false);
    setShowGoogleDrivePicker(false);
    setApiError(null);
    try {
        // Map DriveFile to Source and create dataset entries
        const driveSources: Source[] = driveFiles.map(df => ({
            id: df.id, // Use Drive ID
            fileName: df.name,
            path: 'Google Drive', // Indicate source path
        }));
        // We don't fetch content here, just create entries. Content fetched on demand.
        const newDataset: ElasticResult[] = driveSources.map(source => ({
            source: source,
            contentSnippet: "[Google Drive Content - Fetch on demand]", // Placeholder
            score: 1.0, // Default score
        }));
        console.log(`handleConnectGoogleDrive: Dataset created with ${newDataset.length} Drive entries.`);

        const newChat: Chat = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: dataSource.name, messages: [], createdAt: Date.now(), dataSource, dataset: newDataset,
            groundingOptions: { useCloud: false, usePreloaded: true, useGoogleSearch: false, useGoogleMaps: false }, // Treat Drive as 'preloaded'
        };
        setChats(prev => [newChat, ...prev].sort((a,b)=> b.createdAt - a.createdAt));
        setActiveChatId(newChat.id);
        setEditedFiles(new Map());
        setCloudSearchError(null);
    } catch (error) {
        console.error("Error setting up Google Drive chat:", error);
        setApiError(error instanceof Error ? error.message : "Error setting up Google Drive connection.");
    } finally {
        setIsLoading(false); // Unset loading
    }
  }, []); // Empty dependency array


  // Export table data to Google Sheets
  const handleExportToSheets = useCallback(async (tableData: (string | null)[][]) => {
    if (!tableData || tableData.length === 0) {
        setApiError("No table data selected for export.");
        return;
    }
    setIsLoading(true);
    setApiError(null);
    try {
        const response = await fetch('/api/sheets/export', { // Ensure this endpoint exists and handles auth
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableData }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `Failed to export (${response.status})` }));
            throw new Error(errorData.detail || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        if (data.sheetUrl) {
            window.open(data.sheetUrl, '_blank', 'noopener,noreferrer'); // Open in new tab securely
        } else {
            throw new Error("API response did not include a sheet URL.");
        }
    } catch (error) {
        console.error("Export to Sheets error:", error);
        setApiError(error instanceof Error ? error.message : 'Could not export to Google Sheets.');
    } finally {
        setIsLoading(false);
    }
  }, []); // Empty dependency array


  // Accept or reject a code suggestion
  const handleSuggestionAction = useCallback(async (messageIndex: number, action: 'accepted' | 'rejected') => {
      // Ensure activeChat and messages exist
      if (!activeChat?.messages) return;
      const message = activeChat.messages[messageIndex];
      if (!message?.suggestion) return;

      const updatedSuggestion = { ...message.suggestion, status: action };

      // Update the message in the state first
      updateActiveChat(chat => ({
        ...chat,
        messages: chat.messages.map((msg, index) =>
            index === messageIndex ? { ...msg, suggestion: updatedSuggestion } : msg)
      }));

      let followUpMessageContent: string;
      let followUpMessageType: ResponseType | undefined = undefined;
      let editedFileSource: Source | undefined = undefined;

      if (action === 'accepted') {
          const { file, originalContent, suggestedContent } = message.suggestion;
          let updateSuccess = false;
          let currentDataset = activeChat.dataset || [];

          // Check if the file is local (in the current chat's dataset)
          const isLocal = currentDataset.some(d => d.source.id === file.id);

          if (isLocal) {
              const { success, newDataset } = updateFileContent(file, suggestedContent, currentDataset);
              if (success) {
                  updateSuccess = true;
                  updateActiveChat(c => ({...c, dataset: newDataset})); // Update dataset in chat state
                  console.log("Local file content updated:", file.fileName);
              } else {
                  console.error("Failed to update local file:", file.fileName);
              }
          } else {
              // Non-local (Cloud/Drive) - Log warning, still track edit locally
              console.warn(`Local update skipped for non-local file '${file.fileName}'. Tracking edit.`);
              updateSuccess = true; // Track locally even if not saved remotely
          }

          if (updateSuccess) {
              setEditedFiles(prev => new Map(prev).set(file.id, {
                  file: file,
                  originalContent: prev.get(file.id)?.originalContent ?? originalContent,
                  currentContent: suggestedContent
              }));
              followUpMessageContent = `Applied changes to \`file:${file.fileName}\`.`;
              editedFileSource = file;
              followUpMessageType = ResponseType.CODE_APPLIED;
          } else {
              followUpMessageContent = `Failed to apply changes to \`file:${file.fileName}\`.`;
              followUpMessageType = ResponseType.ERROR;
          }
      } else { // Rejected
          followUpMessageContent = "Okay, discarded the suggested changes.";
          followUpMessageType = ResponseType.INFO;
      }

      // Add follow-up message
      addMessageToActiveChat({
          role: MessageRole.MODEL,
          content: followUpMessageContent,
          editedFile: editedFileSource,
          responseType: followUpMessageType,
          modelId: selectedModel // Include model ID
      });

  }, [activeChat, updateActiveChat, addMessageToActiveChat, selectedModel, getFileContent]); // Added getFileContent


  // --- Other UI Toggles ---
  // Select a file to view its full content or diff
  const handleSelectFile = useCallback(async (file: Source) => {
      console.log("handleSelectFile triggered for:", file.fileName, `(ID: ${file.id})`);
      setSelectedChunkResult(null); // Close chunk viewer
      setDiffViewerRecord(null);   // Close diff viewer

      const editedRecord = editedFiles.get(file.id);
      if (editedRecord) {
          console.log("File is edited, showing diff.");
          // Ensure handleViewDiff is called correctly
          setDiffViewerRecord(editedRecord); // Directly set state for diff viewer
          // handleViewDiff(editedRecord); // This line might be redundant if handleViewDiff just sets state
      } else {
          console.log("File not edited, fetching full content.");
          setSelectedFile(file); // Set file to trigger FileViewer open
          setSelectedFileContent('Loading...'); // Show loading state
          try {
              const content = await getFileContent(file); // Use the updated getFileContent
              // Check if content is an error message returned by getFileContent
              if (content === null || content.startsWith("Error:")) {
                   console.error(`Error loading content in handleSelectFile: ${content}`);
                   setSelectedFileContent(content || 'Error: Could not load file content.'); // Show error in viewer
              } else {
                   setSelectedFileContent(content); // Show actual content
              }
          } catch (error) { // Catch unexpected errors
              console.error("Exception in handleSelectFile -> getFileContent:", error);
              const errorMsg = `Error loading content: ${error instanceof Error ? error.message : 'Unknown error'}`;
              setSelectedFileContent(errorMsg);
              setApiError(errorMsg); // Also set global error if needed
          }
      }
  }, [editedFiles, getFileContent, setDiffViewerRecord, setApiError]); // Updated dependencies


  // Open ChunkViewerModal when a citation or source pill is clicked
  const handleSelectChunk = useCallback((result: ElasticResult) => {
    console.log("handleSelectChunk:", result.source.fileName);
    setSelectedFile(null);       // Close FileViewer if open
    setDiffViewerRecord(null);   // Close DiffViewer if open
    setSelectedChunkResult(result); // Set the selected chunk data to open the modal
  }, []);

  // Close ChunkViewerModal
  const handleCloseChunkViewer = useCallback(() => {
    setSelectedChunkResult(null);
  }, []);

  // Handle click on "Show Full Document" from ChunkViewerModal
  const handleShowFullDocumentFromChunk = useCallback((source: Source) => {
    console.log("Request to show full document for:", source.fileName);
    setSelectedChunkResult(null); // Close the chunk viewer
    handleSelectFile(source);      // Open the full file viewer using existing handler
  }, [handleSelectFile]); // Depends on handleSelectFile


  const handleToggleCodeGeneration = useCallback(() => setIsCodeGenerationEnabled(prev => !prev), []);
  const handleGroundingOptionsChange = useCallback((options: GroundingOptions) => { updateActiveChat(chat => ({ ...chat, groundingOptions: options })); }, [updateActiveChat]);
  const handleViewDiff = useCallback((record: EditedFileRecord) => { console.log("handleViewDiff:", record.file.fileName); setSelectedFile(null); setSelectedChunkResult(null); setDiffViewerRecord(record); }, []);
  const handleCloseDiffViewer = useCallback(() => setDiffViewerRecord(null), []);
  const handleCloseFileViewer = useCallback(() => { setSelectedFile(null); setSelectedFileContent(''); }, []);
  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const handleToggleDataSourceModal = useCallback(() => { setShowGoogleDrivePicker(false); setIsDataSourceModalVisible(prev => !prev); }, []);
  const handleToggleFileSearch = useCallback(() => { setIsFileSearchVisible(prev => { if (!prev) { setIsEditedFilesVisible(false); setDiffViewerRecord(null); setSelectedFile(null); setSelectedChunkResult(null); } return !prev; }); }, []);
  const handleToggleEditedFiles = useCallback(() => { setIsEditedFilesVisible(prev => { if (!prev) { setIsFileSearchVisible(false); setDiffViewerRecord(null); setSelectedFile(null); setSelectedChunkResult(null); } return !prev; }); }, []);


  // --- Render ---
    return (
        <div className={`flex flex-col h-screen font-sans transition-colors duration-300 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden`}> {/* Added overflow-hidden */}
            <Header
                onToggleFileSearch={handleToggleFileSearch}
                onToggleEditedFiles={handleToggleEditedFiles}
                onToggleSidebar={handleToggleSidebar}
                onConnectDataSource={handleToggleDataSourceModal}
                theme={theme}
                setTheme={setTheme}
                activeDataSource={activeChat?.dataSource ?? null}
            />
            {/* Main Content Area - Use Flexbox */}
            <div className="flex-1 flex overflow-hidden relative"> {/* Parent flex container */}
                {/* Sidebar */}
                 <ChatHistory
                    chats={chats}
                    activeChatId={activeChatId}
                    onSelectChat={(id) => { setActiveChatId(id); setSelectedFile(null); setSelectedChunkResult(null); setDiffViewerRecord(null); setIsFileSearchVisible(false); setIsEditedFilesVisible(false);}} // Close modals/panels on chat switch
                    onNewChat={handleNewChat}
                    setChats={setChats}
                    isOpen={isSidebarOpen}
                    files={allFiles} // Pass the combined and sorted file list
                    onSelectFile={handleSelectFile} // Pass the handler
                    activeDataSource={activeChat?.dataSource ?? null}
                 />

                 {/* Main Chat Area - Occupies remaining space, contains scrolling list and fixed input */}
                 <main className="flex-1 flex flex-col overflow-hidden relative bg-slate-50 dark:bg-slate-900"> {/* Use flex-col */}
                    <ErrorBoundary>
                        {/* ChatInterface now handles its own scrolling internally */}
                        <ChatInterface
                            messages={activeChat?.messages || []}
                            isLoading={isLoading}
                            onSendMessage={handleSendMessage}
                            onSelectSourceChunk={handleSelectChunk} // Pass new handler
                            onSelectSource={handleSelectFile}      // Pass handler for full doc view
                            onSuggestionAction={handleSuggestionAction}
                            onExportToSheets={handleExportToSheets}
                            selectedModel={selectedModel}
                            onModelChange={setSelectedModel}
                            activeChat={activeChat} // Pass activeChat *** IMPORTANT ***
                            onConnectDataSource={handleToggleDataSourceModal}
                            isCodeGenerationEnabled={isCodeGenerationEnabled}
                            onToggleCodeGeneration={handleToggleCodeGeneration}
                            groundingOptions={activeChat?.groundingOptions}
                            onGroundingOptionsChange={handleGroundingOptionsChange}
                            apiError={apiError}
                            setApiError={setApiError} // Pass setter *** IMPORTANT ***
                            cloudSearchError={cloudSearchError}
                            // Control auto-scroll based on loading state
                            shouldAutoScroll={!isLoading} // Disable auto-scroll while loading/generating
                        />
                    </ErrorBoundary>
                 </main>

                {/* Side Panels - Absolute positioning relative to the main flex container */}
                <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out transform ${isFileSearchVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                   <FileSearch files={allFiles} onClose={handleToggleFileSearch} onSelectFile={handleSelectFile}/>
                </div>
                <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out transform ${isEditedFilesVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                    <EditedFilesViewer
                        editedFiles={Array.from(editedFiles.values())}
                        onClose={handleToggleEditedFiles}
                        onSelectFile={handleViewDiff}
                    />
                </div>

                {/* Modals - Rendered last to appear on top */}
                {selectedFile && <FileViewer file={selectedFile} content={selectedFileContent} onClose={handleCloseFileViewer} />}
                {selectedChunkResult && <ChunkViewerModal result={selectedChunkResult} onClose={handleCloseChunkViewer} onShowFullDocument={handleShowFullDocumentFromChunk} />}
                {diffViewerRecord && <DiffViewerModal record={diffViewerRecord} onClose={handleCloseDiffViewer} />}
                {isDataSourceModalVisible && <DataSourceModal onClose={handleToggleDataSourceModal} onConnect={handleConnectDataSource} showGoogleDrivePicker={showGoogleDrivePicker} onConnectGoogleDrive={handleConnectGoogleDrive} />}
            </div>
        </div>
    );
};

export default App;

