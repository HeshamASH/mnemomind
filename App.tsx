
import React, { useState, useCallback, useEffect } from 'react';
import { ChatMessage, MessageRole, Source, ElasticResult, Intent, CodeSuggestion, ModelId, MODELS, ResponseType, Chat, Theme, Attachment, DataSource, GroundingOptions, DriveFile } from './types';
import { searchCloudDocuments, getAllCloudFiles, getCloudFileContent, createDatasetFromSources, updateFileContent, searchPreloadedDocuments, getAllPreloadedFiles, getPreloadedFileContent } from './services/elasticService';
import { streamAiResponse, classifyIntent, streamChitChatResponse, streamCodeGenerationResponse } from './services/geminiService';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import FileSearch from './components/FileSearch';
import FileViewer from './components/FileViewer';
import EditedFilesViewer from './components/EditedFilesViewer';
import DiffViewerModal from './components/DiffViewerModal';
import ChatHistory from './components/ChatHistory';
import GoogleDrivePicker from './components/GoogleDrivePicker';
import DataSourceModal from './components/DataSourceModal';
import ErrorBoundary from './components/ErrorBoundary';
import { reciprocalRankFusion } from './utils/rrf';

const HISTORY_KEY = 'elastic-codemind-state';
const EDITABLE_EXTENSIONS = [
  'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'html', 'css', 'scss', 'less',
  'py', 'rb', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rs', 'swift',
  'kt', 'kts', 'dart', 'sh', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'txt'
];

export interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme') as Theme;
      return storedTheme || 'light';
    }
    return 'light';
  });

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allFiles, setAllFiles] = useState<Source[]>([]);
  const [isFileSearchVisible, setIsFileSearchVisible] = useState<boolean>(false);
  const [isEditedFilesVisible, setIsEditedFilesVisible] = useState<boolean>(false);
  const [isDataSourceModalVisible, setIsDataSourceModalVisible] = useState<boolean>(false);
  const [editedFiles, setEditedFiles] = useState<Map<string, EditedFileRecord>>(new Map());
  const [selectedFile, setSelectedFile] = useState<Source | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.GEMINI_FLASH_LITE);
  const [diffViewerRecord, setDiffViewerRecord] = useState<EditedFileRecord | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCodeGenerationEnabled, setIsCodeGenerationEnabled] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [cloudSearchError, setCloudSearchError] = useState<string | null>(null);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState<boolean>(false);

  const activeChat = chats.find(c => c.id === activeChatId);
  const groundingOptions = activeChat?.groundingOptions;

  const updateActiveChat = useCallback((updater: (chat: Chat) => Chat) => {
    setChats(prevChats => prevChats.map(chat =>
      chat.id === activeChatId ? updater(chat) : chat
    ));
  }, [activeChatId]);

  // --- Handlers ---
  const handleNewChat = useCallback(() => {
    const newChat: Chat = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      dataSource: null,
      dataset: [],
      groundingOptions: {
        useCloud: true,
        usePreloaded: false,
        useGoogleSearch: false,
        useGoogleMaps: false,
      },
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setEditedFiles(new Map());
    setCloudSearchError(null);
    setIsCodeGenerationEnabled(false);
  }, []);

  // --- Effects ---

  useEffect(() => {
    try {
      const savedState = localStorage.getItem(HISTORY_KEY);
      if (savedState) {
        const { chats: savedChats, activeChatId: savedActiveChatId, model: savedModel } = JSON.parse(savedState);
        const restoredChats = (savedChats || []).map((chat: any) => {
            // Migration logic for old chat structure
            const groundingOptions = chat.groundingOptions || {
                useCloud: chat.groundingSource === 'elastic_cloud' || chat.groundingSource === 'hybrid' || (!chat.dataSource && chat.groundingSource !== 'preloaded'),
                usePreloaded: chat.groundingSource === 'preloaded' || chat.groundingSource === 'hybrid' || (!!chat.dataSource),
                useGoogleSearch: false,
                useGoogleMaps: false,
            };
            return {
              ...chat, 
              dataset: chat.dataset || [],
              groundingOptions: groundingOptions
            };
        });
        setChats(restoredChats);
        setActiveChatId(savedActiveChatId || null);
        setSelectedModel(savedModel || ModelId.GEMINI_FLASH_LITE);
        if (!savedActiveChatId && restoredChats.length > 0) {
            setActiveChatId(restoredChats[0].id);
        } else if (restoredChats.length === 0) {
           handleNewChat();
        }
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to parse state from localStorage", error);
      handleNewChat();
    }
  // handleNewChat is memoized and has no dependencies, so this effect runs only once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const stateToSave = JSON.stringify({ chats, activeChatId, model: selectedModel });
      localStorage.setItem(HISTORY_KEY, stateToSave);
    } catch (error)
      {
      console.error("Failed to save state to localStorage", error);
    }
  }, [chats, activeChatId, selectedModel]);
  
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Geolocation acquired:", position);
                setLocation(position);
            },
            (error) => {
                console.warn(`Geolocation error: ${error.message}. Maps grounding will be less effective.`);
            }
        );
    }
  }, []); // Runs once on mount

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'google-drive') {
      setIsDataSourceModalVisible(true);
      setShowGoogleDrivePicker(true);
    }
  }, []);
  
  useEffect(() => {
    const fetchFiles = async () => {
      if (!activeChat || !groundingOptions) {
        setAllFiles([]);
        return;
      }

      // Start with preloaded files if the option is active
      const preloadedFiles = groundingOptions.usePreloaded
        ? getAllPreloadedFiles(activeChat.dataset)
        : [];

      // If cloud is not enabled, just set preloaded files and we're done.
      if (!groundingOptions.useCloud) {
        setAllFiles(preloadedFiles);
        setCloudSearchError(null); // Clear any previous cloud errors
        return;
      }
      
      // If cloud is enabled, try to fetch them.
      try {
        setCloudSearchError(null); // Reset error before the attempt
        const cloudFiles = await getAllCloudFiles();
              // Filter out preloaded files that are already present in cloudFiles (by name and path)
              preloadedFiles = preloadedFiles.filter(preloadedFile =>
                !cloudFiles.some(cloudFile =>
                  cloudFile.file_name === preloadedFile.file_name && cloudFile.path === preloadedFile.path
                )
              );
        
              const combined = [...cloudFiles, ...preloadedFiles];
              const uniqueFiles = Array.from(new Map(combined.map(file => [file.id, file])).values());
              setAllFiles(uniqueFiles);      } catch (error) {
        console.error("Error fetching cloud files:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch cloud files.";
        setCloudSearchError(errorMessage);

        // If fetching fails, update UI to reflect this
        setAllFiles(preloadedFiles); // Fallback to only preloaded files
        updateActiveChat(chat => ({
          ...chat,
          // Turn off the cloud option for this chat since it's failing
          groundingOptions: { ...chat.groundingOptions, useCloud: false }
        }));
      }
    };

    fetchFiles();
    
    // Side-effect to ensure preloaded is off if there's no data source
    if (activeChat && !activeChat.dataSource && groundingOptions?.usePreloaded) {
        updateActiveChat(chat => ({
            ...chat,
            groundingOptions: { ...chat.groundingOptions, usePreloaded: false }
        }));
    }
  }, [activeChatId, activeChat?.dataSource, groundingOptions?.useCloud, groundingOptions?.usePreloaded, updateActiveChat, activeChat, groundingOptions]);


  const messages = activeChat?.messages || [];

  const addMessageToActiveChat = (message: ChatMessage) => {
    updateActiveChat(chat => ({ ...chat, messages: [...chat.messages, message] }));
  };
  
  const updateLastMessageInActiveChat = (updater: (message: ChatMessage) => ChatMessage) => {
    updateActiveChat(chat => ({
        ...chat,
        messages: chat.messages.map((msg, index) => 
            index === chat.messages.length - 1 ? updater(msg) : msg
        )
    }));
  };
  
  const searchElastic = async (query: string): Promise<ElasticResult[]> => {
    if (!activeChat) return [];
    setCloudSearchError(null);

    const searchPromises: Promise<ElasticResult[]>[] = [];
    const { useCloud, usePreloaded } = activeChat.groundingOptions;

    if (useCloud) {
        searchPromises.push(searchCloudDocuments(query));
    }
    if (usePreloaded) {
      searchPromises.push(Promise.resolve(searchPreloadedDocuments(query, activeChat.dataset)));
    }

    try {
      const searchResults = await Promise.all(searchPromises);
      const fusedResults = reciprocalRankFusion(searchResults);
      return fusedResults.slice(0, 10);
    } catch (error) {
      console.error("Search failed:", error);
      setCloudSearchError(error instanceof Error ? error.message : "Failed to fetch from cloud.");
      return [];
    }
  };

  const getFileContent = async (source: Source): Promise<string | null> => {
      if (!activeChat) return null;

      if (activeChat.dataSource?.type === 'drive') {
        try {
          const response = await fetch(`/api/drive/files/${source.id}`);
          if (!response.ok) {
            throw new Error('Failed to fetch Google Drive file content');
          }
          const data = await response.json();
          return data.content;
        } catch (error) {
          setApiError(error instanceof Error ? error.message : 'Could not load file content.');
return `Error: Could not load content for ${source.file_name}.`;
        }
      }

      // Check if the file is from the preloaded dataset first.
      if (source.id.startsWith('custom-')) {
          return getPreloadedFileContent(source, activeChat.dataset);
      }
      // Otherwise, assume it's from the cloud.
      try {
        return await getCloudFileContent(source);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Could not load file content.');
        return `Error: Could not load content for ${source.file_name}.`;
      }
  };

  // --- More Handlers ---
  
  const handleQueryDocuments = async (currentMessages: ChatMessage[]) => {
    if (!activeChat) return;

    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: '',
      sources: [],
      groundingChunks: [],
      responseType: ResponseType.RAG,
      modelId: selectedModel
    });

    const latestQuery = currentMessages[currentMessages.length - 1];


    const { useCloud, usePreloaded, useGoogleSearch, useGoogleMaps } = activeChat.groundingOptions;

    let elasticResults: ElasticResult[] = [];
    if (useCloud || usePreloaded) {
      elasticResults = await searchElastic(latestQuery.content);
      console.log("elasticResults", elasticResults);
    }

    // If only Google Search is enabled, then use it.
    if (useGoogleSearch && !useCloud && !usePreloaded) {
        console.log("Only Google Search enabled, using Google Search.");
        const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
        const responseStream = await streamAiResponse(currentMessages, [], modelToUse, { ...activeChat.groundingOptions, useGoogleSearch: true }, location);
        updateLastMessageInActiveChat(msg => ({ ...msg, responseType: ResponseType.GOOGLE_SEARCH }));
        let allGroundingChunks: any[] = [];
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            updateLastMessageInActiveChat(msg => ({ ...msg, content: msg.content + chunkText }));
            
            const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (newChunks) {
                allGroundingChunks.push(...newChunks);
            }
        }
        const uniqueChunks = Array.from(new Map(allGroundingChunks.map(item => [item.web?.uri || item.maps?.uri, item])).values());
        updateLastMessageInActiveChat(msg => ({ ...msg, groundingChunks: uniqueChunks }));
        return;
    } else if (elasticResults.length === 0 && (useCloud || usePreloaded)) {
        // If elastic results are empty, but cloud or preloaded were enabled,
        // and Google Search is not exclusively enabled, then no results.
        updateLastMessageInActiveChat(msg => ({ ...msg, content: "I couldn't find any relevant information from your data sources." }));
        return;
    }
    
    updateLastMessageInActiveChat(msg => ({ ...msg, sources: elasticResults }));

    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamAiResponse(currentMessages, elasticResults, modelToUse, activeChat.groundingOptions, location);
    
    let allGroundingChunks: any[] = [];
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      updateLastMessageInActiveChat(msg => ({ ...msg, content: msg.content + chunkText }));
      
      const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (newChunks) {
        allGroundingChunks.push(...newChunks);
      }
    }

    // Deduplicate and set final grounding chunks
    const uniqueChunks = Array.from(new Map(allGroundingChunks.map(item => [item.web?.uri || item.maps?.uri, item])).values());
    updateLastMessageInActiveChat(msg => ({ ...msg, groundingChunks: uniqueChunks }));
  };
  
  const handleChitChat = async (currentMessages: ChatMessage[]) => {
    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: '',
      responseType: ResponseType.CHIT_CHAT,
      modelId: selectedModel
    });
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamChitChatResponse(currentMessages, modelToUse);
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      updateLastMessageInActiveChat(msg => ({ ...msg, content: msg.content + chunkText }));
    }
  };

  const handleCodeGeneration = async (currentMessages: ChatMessage[]) => {
    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: 'Thinking about the file...', 
      responseType: ResponseType.CODE_GENERATION,
      modelId: selectedModel
    });

    const latestQuery = currentMessages[currentMessages.length - 1].content;
    const searchResults = await searchElastic(latestQuery);
    
    const editableSearchResults = searchResults.filter(r => {
        const extension = r.source.file_name.split('.').pop()?.toLowerCase();
        return extension && EDITABLE_EXTENSIONS.includes(extension);
    });
    
    if (editableSearchResults.length === 0) {
        updateLastMessageInActiveChat(msg => ({ ...msg, content: "I couldn't find any editable files relevant to your request. I can only edit text-based source code and document files, not PDFs or other binary formats." }));
        return;
    }
    
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamCodeGenerationResponse(currentMessages, editableSearchResults, modelToUse);
    let responseJsonText = '';
    for await (const chunk of responseStream) {
        responseJsonText += chunk.text;
    }

    try {
        const responseObject = JSON.parse(responseJsonText);
        if (responseObject.error) throw new Error(responseObject.error);
        
        const fullPath = responseObject.filePath;
        const file = allFiles.find(f => `${f.path}/${f.file_name}` === fullPath);
        
        if (!file) throw new Error(`The model suggested editing a file I couldn't find: ${fullPath}`);

        const originalContent = await getFileContent(file);
        if (originalContent === null) throw new Error(`Could not fetch original content for ${file.file_name}.`);

        const suggestion: CodeSuggestion = {
            file,
            thought: responseObject.thought,
            originalContent,
            suggestedContent: responseObject.newContent,
            status: 'pending',
        };
        updateLastMessageInActiveChat(msg => ({ ...msg, content: `I have a suggestion for 
file:${file.file_name}". Here are the changes:`, suggestion }));
    } catch (e) {
        console.error("Code generation parsing error:", e);
        const errorMessage = e instanceof Error ? e.message : "Sorry, I couldn't generate the edit correctly.";
        updateLastMessageInActiveChat(msg => ({ ...msg, content: errorMessage }));
    }
  };

  const handleSendMessage = useCallback(async (query: string, attachment?: Attachment) => {
    if (!query.trim() || isLoading || !activeChat) return;
    setIsLoading(true);
    setApiError(null);
    
    const userMessage: ChatMessage = { role: MessageRole.USER, content: query, attachment };
    const newMessages = [...messages, userMessage];
    updateActiveChat(chat => ({
      ...chat, 
      messages: [...chat.messages, userMessage],
      title: chat.messages.length === 0 ? query.substring(0, 30) : chat.title
    }));
    
    try {
      const { useCloud, usePreloaded, useGoogleSearch, useGoogleMaps } = activeChat.groundingOptions;
      const isGrounded = useCloud || usePreloaded || useGoogleSearch || useGoogleMaps;

      if (isGrounded || attachment) {
          const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
          let intent = await classifyIntent(query, modelToUse);

          if (intent === Intent.GENERATE_CODE && !isCodeGenerationEnabled) {
              intent = Intent.QUERY_DOCUMENTS;
          }
          
          if (attachment?.type.startsWith('image/')) {
              await handleQueryDocuments(newMessages);
          } else {
              switch (intent) {
                case Intent.GENERATE_CODE: await handleCodeGeneration(newMessages); break;
                case Intent.CHIT_CHAT: 
                    // If any grounding is on, treat chit-chat as a grounded query
                    if (usePreloaded || useGoogleSearch || useGoogleMaps) await handleQueryDocuments(newMessages); 
                    else await handleChitChat(newMessages);
                    break;
                default: await handleQueryDocuments(newMessages); break;
              }
          }
      } else {
        await handleChitChat(newMessages);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessageContent = error instanceof Error ? error.message : "An unknown error occurred.";
      addMessageToActiveChat({ role: MessageRole.MODEL, content: `Sorry, I encountered an error: ${errorMessageContent}` });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, allFiles, messages, selectedModel, activeChat, isCodeGenerationEnabled, updateActiveChat, location]);
  
  const handleConnectDataSource = useCallback(async (files: File[], dataSource: DataSource) => {
    setIsLoading(true);
    setIsDataSourceModalVisible(false);
    setApiError(null);
    try {
        const newDataset = await createDatasetFromSources(files);
        const newChat: Chat = {
          id: `chat_${Date.now()}`,
          title: dataSource.name,
          messages: [],
          createdAt: Date.now(),
          dataSource,
          dataset: newDataset,
          groundingOptions: {
            useCloud: false,
            usePreloaded: true,
            useGoogleSearch: false,
            useGoogleMaps: false,
          },
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setEditedFiles(new Map());
        setCloudSearchError(null);
    } catch (error) {
        console.error("Error processing data source:", error);
        setApiError(error instanceof Error ? error.message : "An unknown error occurred while processing files.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleConnectGoogleDrive = useCallback(async (files: DriveFile[], dataSource: DataSource) => {
    setIsDataSourceModalVisible(false);
    setShowGoogleDrivePicker(false);
    const newChat: Chat = {
      id: `chat_${Date.now()}`,
      title: dataSource.name,
      messages: [],
      createdAt: Date.now(),
      dataSource,
      dataset: [], // Dataset will be populated from Google Drive files
      groundingOptions: {
        useCloud: false,
        usePreloaded: true, // We will treat Google Drive files as preloaded
        useGoogleSearch: false,
        useGoogleMaps: false,
      },
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setEditedFiles(new Map());
    setCloudSearchError(null);
  }, []);

  const handleExportToSheets = useCallback(async (tableData: (string | null)[][]) => {
    try {
      const response = await fetch('/api/sheets/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableData }),
      });
      if (!response.ok) {
        throw new Error('Failed to export to Google Sheets');
      }
      const data = await response.json();
      window.open(data.sheetUrl, '_blank');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not export to Google Sheets.');
    }
  }, []);

  const handleSuggestionAction = useCallback(async (messageIndex: number, action: 'accepted' | 'rejected') => {
      if (!activeChat) return;
      const message = messages[messageIndex];
      if (!message || !message.suggestion) return;

      const updatedSuggestion = { ...message.suggestion, status: action };
      
      updateActiveChat(chat => ({
        ...chat,
        messages: chat.messages.map((msg, index) => 
            index === messageIndex ? { ...msg, suggestion: updatedSuggestion } : msg)
      }));
      
      let followUpMessage: ChatMessage;
      if (action === 'accepted') {
          const { file, originalContent, suggestedContent } = message.suggestion;
          
          const { success, newDataset } = updateFileContent(file, suggestedContent, activeChat.dataset);
          if (!success) {
            followUpMessage = { role: MessageRole.MODEL, content: `Sorry, I failed to apply the changes to 
file:${file.file_name}". Could not find the file in the preloaded dataset.` };
          } else {
            updateActiveChat(c => ({...c, dataset: newDataset}));
            setEditedFiles(prev => new Map(prev).set(file!.id, { file: file!, originalContent: prev.get(file!.id)?.originalContent ?? originalContent, currentContent: suggestedContent }));
            followUpMessage = { role: MessageRole.MODEL, content: `Great! I've applied the changes to 
file:${file.file_name}".`, editedFile: file };
          }
      } else {
          followUpMessage = { role: MessageRole.MODEL, content: "Okay, I've discarded the changes." };
      }
      addMessageToActiveChat(followUpMessage);
  }, [messages, activeChat, updateActiveChat]);

  const handleSelectFile = useCallback(async (file: Source) => {
    const editedRecord = editedFiles.get(file.id);
    if (editedRecord) {
        handleViewDiff(editedRecord);
    } else {
        setSelectedFile(file);
        setSelectedFileContent('Loading...');
        const content = await getFileContent(file);
        setSelectedFileContent(content ?? 'Could not load file content.');
    }
  }, [editedFiles, getFileContent]);

  const handleToggleCodeGeneration = useCallback(() => setIsCodeGenerationEnabled(prev => !prev), []);
  
  const handleGroundingOptionsChange = useCallback((options: GroundingOptions) => {
      updateActiveChat(chat => ({ ...chat, groundingOptions: options }));
  }, [updateActiveChat]);

  const handleViewDiff = useCallback((record: EditedFileRecord) => setDiffViewerRecord(record), []);
  const handleCloseDiffViewer = useCallback(() => setDiffViewerRecord(null), []);
  const handleCloseFileViewer = useCallback(() => { setSelectedFile(null); setSelectedFileContent(''); }, []);
  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const handleToggleDataSourceModal = useCallback(() => setIsDataSourceModalVisible(prev => !prev), []);

  const handleToggleFileSearch = useCallback(() => {
    setIsFileSearchVisible(prev => {
      const isOpening = !prev;
      if (isOpening) setIsEditedFilesVisible(false);
      return isOpening;
    });
  }, []);

  const handleToggleEditedFiles = useCallback(() => {
    setIsEditedFilesVisible(prev => {
      const isOpening = !prev;
      if (isOpening) setIsFileSearchVisible(false);
      return isOpening;
    });
  }, []);

  return (
    <div className={`flex flex-col h-screen font-sans transition-colors duration-300 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200`}>
      <Header 
        onToggleFileSearch={handleToggleFileSearch} 
        onToggleEditedFiles={handleToggleEditedFiles}
        onToggleSidebar={handleToggleSidebar}
        onConnectDataSource={handleToggleDataSourceModal}
        theme={theme}
        setTheme={setTheme}
        activeDataSource={activeChat?.dataSource ?? null}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <ChatHistory 
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onNewChat={handleNewChat}
          setChats={setChats}
          isOpen={isSidebarOpen}
          files={allFiles}
          onSelectFile={handleSelectFile}
          activeDataSource={activeChat?.dataSource ?? null}
        />
        <main className="flex-1 overflow-hidden transition-all duration-300">
           <ErrorBoundary>
              <ChatInterface 
                messages={messages} 
                isLoading={isLoading} 
                onSendMessage={handleSendMessage} 
                onSelectSource={handleSelectFile}
                onSuggestionAction={handleSuggestionAction}
                onExportToSheets={handleExportToSheets}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                activeDataSource={activeChat?.dataSource}
                onConnectDataSource={handleToggleDataSourceModal}
                isCodeGenerationEnabled={isCodeGenerationEnabled}
                onToggleCodeGeneration={handleToggleCodeGeneration}
                groundingOptions={activeChat?.groundingOptions}
                onGroundingOptionsChange={handleGroundingOptionsChange}
                apiError={apiError}
                setApiError={setApiError}
                cloudSearchError={cloudSearchError}
              />
           </ErrorBoundary>
        </main>
        
        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isFileSearchVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <FileSearch files={allFiles} onClose={handleToggleFileSearch} onSelectFile={handleSelectFile}/>
        </div>

        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isEditedFilesVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <EditedFilesViewer
            editedFiles={Array.from(editedFiles.values())}
            onClose={handleToggleEditedFiles}
            onSelectFile={handleViewDiff}
          />
        </div>

        {selectedFile && <FileViewer file={selectedFile} content={selectedFileContent} onClose={handleCloseFileViewer} />}
        {diffViewerRecord && <DiffViewerModal record={diffViewerRecord} onClose={handleCloseDiffViewer} />}
        {isDataSourceModalVisible && 
          <DataSourceModal 
            onClose={handleToggleDataSourceModal} 
            onConnect={handleConnectDataSource} 
            showGoogleDrivePicker={showGoogleDrivePicker}
            onConnectGoogleDrive={handleConnectGoogleDrive}
          />}
      </div>
    </div>
  );
};

export default App;
