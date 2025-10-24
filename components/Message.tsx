import React, { useRef, useEffect, useState, useCallback } from 'react';
// Import ElasticResult type
import { ChatMessage, MessageRole, Source, ResponseType, ModelId, MODELS, ElasticResult } from '../types';
import SourcePill from './SourcePill';
import CodeSuggestionViewer from './CodeSuggestionViewer';
import MarkdownRenderer from './MarkdownRenderer';
import AttachmentPreview from './AttachmentPreview';

interface MessageProps {
  message: ChatMessage;
  // Handler for clicking a citation [n] or a source pill to show the specific chunk
  onSelectSourceChunk: (result: ElasticResult) => void;
  // Handler for the "Show Full Document" button inside the chunk viewer (passed via MarkdownRenderer -> ChunkViewer)
  onSelectSource: (source: Source) => void;
  onSuggestionAction: (action: 'accepted' | 'rejected') => void;
  onExportToSheets: (tableData: (string | null)[][]) => void;
}

// --- Icons ---
const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const ModelIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        {/* Simple sparkle icon as placeholder */}
        <path fillRule="evenodd" d="M9.315 7.585c.932-1.003 2.443-1.003 3.375 0l1.453 1.559c.466.502.706 1.168.706 1.846 0 .678-.24 1.344-.706 1.846l-1.453 1.559c-.932 1.003-2.443 1.003-3.375 0l-1.453-1.559a2.983 2.983 0 0 1-.706-1.846c0-.678.24-1.344.706-1.846l1.453-1.559Zm-3.81 2.417L4.13 8.627a.75.75 0 0 1 1.06-1.06l1.373 1.374a.75.75 0 0 1-1.06 1.06Zm10.48-.002-1.374-1.374a.75.75 0 1 1 1.06-1.06l1.374 1.373a.75.75 0 1 1-1.06 1.06ZM10.003 3.19a.75.75 0 0 1 .75-.75h2.494a.75.75 0 0 1 0 1.5h-2.494a.75.75 0 0 1-.75-.75Zm-.75 16.12a.75.75 0 0 1 .75-.75h2.494a.75.75 0 0 1 0 1.5h-2.494a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
);


const SpeakerOnIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);

const SpeakerOffIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);

const WebIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      {/* Simple Globe Icon */}
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16ZM4.217 4.04a6.5 6.5 0 0 1 7.566 0l.27-.47a7.5 7.5 0 0 0-8.106 0l.27.47Z M11.96 11.96a6.503 6.503 0 0 1-7.92 0l-.47.27a7.5 7.5 0 0 0 8.86 0l-.47-.27Z M3.75 8a4.25 4.25 0 0 1 8.5 0H14a6 6 0 0 0-12 0h1.75Z"/>
    </svg>
);

const MapIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="m8 16-5.223-8.212a5.75 5.75 0 1 1 10.446 0L8 16Zm.25-10.5a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0Z" clipRule="evenodd" />
    </svg>
);


// --- Message Metadata Component ---
const MessageMetadata: React.FC<{ responseType?: ResponseType, modelId?: ModelId }> = ({ responseType, modelId }) => {
    // Only render if both type and model are known
    if (!responseType || !modelId) return null;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return null; // Should not happen if modelId is valid

    // Don't show metadata for simple chit-chat or errors
    if (responseType === ResponseType.CHIT_CHAT || responseType === ResponseType.ERROR) return null;


    return (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-2 font-medium">
            <span>{responseType}</span> {/* Display the type (RAG, Web Search, etc.) */}
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span>{model.name}</span> {/* Display the model name */}
        </div>
    );
};


// --- Main Message Component ---
const Message: React.FC<MessageProps> = ({
    message,
    onSelectSourceChunk, // Renamed handler
    onSelectSource,      // Kept for passing down
    onSuggestionAction,
    onExportToSheets
}) => {
  const isModel = message.role === MessageRole.MODEL;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Determine if there are sources from Elastic/Preloaded or Gemini grounding
  const hasElasticSources = message.elasticSources && message.elasticSources.length > 0;
  const hasGroundingChunks = message.groundingChunks && message.groundingChunks.length > 0;


  // --- Speech Synthesis Logic ---
  const handleToggleSpeech = useCallback(() => {
    if (!message.content) return; // Don't speak empty content

    if (isSpeaking) {
        window.speechSynthesis.cancel(); // Stop current speech
        setIsSpeaking(false);
    } else {
        // Ensure any previous speech is stopped before starting new
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            setIsSpeaking(false);
            // Optionally notify user about the error
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    }
  }, [isSpeaking, message.content]);

  // Cleanup speech synthesis on component unmount or when message content changes
  useEffect(() => {
    return () => {
        if (utteranceRef.current) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false); // Reset state on unmount
        }
    };
  }, [message.content]); // Rerun cleanup if message content changes


  // --- Citation Click Handler ---
  // This handler receives the 0-based index from MarkdownRenderer
  const handleCitationClick = useCallback((index: number) => {
      if (message.elasticSources && message.elasticSources[index]) {
          console.log(`Citation [${index + 1}] clicked, showing chunk:`, message.elasticSources[index]);
          onSelectSourceChunk(message.elasticSources[index]);
      } else {
          console.warn(`Clicked citation [${index + 1}] but corresponding elasticSource not found.`);
          // Optionally provide feedback to the user that the source isn't available
      }
  }, [message.elasticSources, onSelectSourceChunk]);


  // --- Render ---
  return (
    <div className={`flex items-start gap-3 sm:gap-4 ${!isModel && 'flex-row-reverse'}`}>
      {/* Avatar */}
       <div className={`flex-shrink-0 rounded-full p-1.5 sm:p-2 border ${isModel ? 'bg-cyan-100 dark:bg-cyan-900 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
        {isModel ? <ModelIcon /> : <UserIcon />}
      </div>

      {/* Message Bubble and Metadata/Sources */}
       <div className={`flex flex-col w-full max-w-xl md:max-w-2xl lg:max-w-3xl ${!isModel && 'items-end'}`}>
         {/* Metadata (Type and Model) */}
         {isModel && <MessageMetadata responseType={message.responseType} modelId={message.modelId} />}

         {/* Main Message Bubble */}
         <div className={`group relative rounded-lg px-4 py-2 sm:px-5 sm:py-3 shadow-sm ${isModel ? 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700' : 'bg-cyan-600 text-white dark:bg-cyan-700'}`}>
            {/* Attachment */}
            {message.attachment && (
                <div className="mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <AttachmentPreview attachment={message.attachment} onRemove={() => {}} isReadOnly />
                </div>
            )}
            {/* Content (Markdown or Loading) */}
           <div className="min-w-[50px]"> {/* Ensure minimum width for loading dots */}
              {message.content ? (
                 <MarkdownRenderer
                    text={message.content}
                    onExportToSheets={onExportToSheets}
                    // Pass handler and sources for clickable citations
                    onCitationClick={handleCitationClick}
                    elasticSources={message.elasticSources}
                 />
              ) : (
                // Loading indicator
                isModel && (
                    <div className="flex items-center gap-1.5 py-1">
                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full inline-block animate-pulse" style={{ animationDelay: '0s' }}></span>
                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full inline-block animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full inline-block animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                )
              )}
           </div>
           {/* Speech Toggle Button */}
            {isModel && message.content && (
                <button
                    onClick={handleToggleSpeech}
                    className="absolute -bottom-3 right-1 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                    aria-label={isSpeaking ? "Stop speaking" : "Read message aloud"}
                >
                    {isSpeaking ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                </button>
            )}
         </div>

         {/* Code Suggestion Viewer */}
          {isModel && message.suggestion && (
            <div className="mt-3 w-full">
                <CodeSuggestionViewer
                    suggestion={message.suggestion}
                    onAction={onSuggestionAction}
                />
            </div>
        )}

         {/* Edited File Pill */}
         {isModel && message.editedFile && (
           <div className="mt-3 flex flex-wrap gap-2">
             <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Applied Edit:</span>
             <SourcePill
               key={message.editedFile.id}
               source={message.editedFile}
               // Clicking edited pill should probably open the diff viewer or full file viewer
               onClick={() => onSelectSource(message.editedFile)}
               isEdited={true}
               citationNumber={null} // No citation for edited file pill itself
             />
           </div>
         )}

         {/* Sources Section (Pills for Elastic/Preloaded, Links for Web/Maps) */}
         {(hasElasticSources || hasGroundingChunks) && (
           <div className="mt-3 space-y-2 w-full"> {/* Ensure sources take full width */}
             {/* Elastic/Preloaded Source Pills */}
             {hasElasticSources && (
               <div className="flex flex-wrap gap-2 items-center">
                 <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 self-center">Sources:</span>
                 {message.elasticSources.map((result, index) => (
                   <SourcePill
                     key={result.source.id + '-' + index} // Use index for uniqueness if IDs aren't unique across sources
                     source={result.source}
                     // Clicking pill shows the specific chunk
                     onClick={() => onSelectSourceChunk(result)}
                     citationNumber={index + 1} // Pass 1-based index
                   />
                 ))}
               </div>
             )}
              {/* Web/Maps Grounding Links */}
              {hasGroundingChunks && (
                 <div className="flex flex-wrap gap-2 items-center">
                   <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 self-center">
                    {message.groundingChunks.some(c => c.maps) ? 'Web & Map Results:' : 'Web Results:'} {/* Adjust label */}
                   </span>
                   {message.groundingChunks.map((chunk, index) => {
                      const source = chunk.web || chunk.maps;
                      if (!source?.uri) return null; // Skip if no URI
                      const title = source.title || (source.uri ? new URL(source.uri).hostname.replace('www.', '') : 'External Source');
                      return (
                        <a
                          key={`grounding-${index}`}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-200 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300"
                          title={`${source.title || 'View source'} (${source.uri})`} // Add URI to title
                        >
                          {chunk.web ? <WebIcon /> : <MapIcon />}
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{title}</span> {/* Truncate long titles */}
                        </a>
                      )
                   })}
                 </div>
               )}
           </div>
         )}
       </div>
    </div>
  );
};

export default Message;

