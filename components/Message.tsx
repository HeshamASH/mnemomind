import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage, MessageRole, Source, ResponseType, ModelId, MODELS } from '../types';
import SourcePill from './SourcePill';
import CodeSuggestionViewer from './CodeSuggestionViewer';
import MarkdownRenderer from './MarkdownRenderer';
import AttachmentPreview from './AttachmentPreview';

interface MessageProps {
  message: ChatMessage;
  messageIndex: number;
  onSelectSource: (source: Source) => void;
  onSuggestionAction: (action: 'accepted' | 'rejected') => void;
  onExportToSheets: (tableData: (string | null)[][]) => void;
}

const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const ModelIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M9.315 7.585c.932-1.003 2.443-1.003 3.375 0l1.453 1.559c.466.502.706 1.168.706 1.846 0 .678-.24 1.344-.706 1.846l-1.453 1.559c-.932 1.003-2.443 1.003-3.375 0l-1.453-1.559a2.983 2.983 0 0 1-.706-1.846c0-.678.24-1.344.706-1.846l1.453-1.559Z" clipRule="evenodd" />
        <path d="M21.565 4.435a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
        <path d="M3.5 6.995a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06Z" />
        <path d="M17.005 20.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0Z" />
        <path d="M6.995 3.5a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
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
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16ZM5.22 6.22a.75.75 0 0 1 1.06 0L8 7.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 9.06l1.72 1.72a.75.75 0 1 1-1.06 1.06L8 10.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 9.06 5.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
);

const MapIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="m8 16-5.223-8.212a5.75 5.75 0 1 1 10.446 0L8 16Zm.25-10.5a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0Z" clipRule="evenodd" />
    </svg>
);


const MessageMetadata: React.FC<{ responseType?: ResponseType, modelId?: ModelId }> = ({ responseType, modelId }) => {
    if (!responseType || !modelId) return null;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return null;

    return (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-2">
            <span>{responseType}</span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span>{model.name}</span>
        </div>
    );
};


const Message: React.FC<MessageProps> = ({ message, messageIndex, onSelectSource, onSuggestionAction, onExportToSheets }) => {
  const isModel = message.role === MessageRole.MODEL;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const hasElasticSources = message.sources && message.sources.length > 0;
  const hasGroundingChunks = message.groundingChunks && message.groundingChunks.length > 0;


  const handleToggleSpeech = useCallback(() => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    } else {
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            setIsSpeaking(false);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    }
  }, [isSpeaking, message.content]);

  useEffect(() => {
    const handleSourceLinkClick = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { sourceId, messageIndex: clickedMessageIndex } = customEvent.detail;
      if (messageIndex === clickedMessageIndex) {
        setIsSourcesOpen(true);
        setTimeout(() => {
            const element = document.getElementById(sourceId);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    window.addEventListener('sourceLinkClick', handleSourceLinkClick);

    return () => {
      window.removeEventListener('sourceLinkClick', handleSourceLinkClick);
    };
  }, [messageIndex]);

  useEffect(() => {
    return () => {
        // Cleanup speech synthesis on component unmount
        if (utteranceRef.current) {
            window.speechSynthesis.cancel();
        }
    };
  }, []);

  return (
    <div className={`flex items-start gap-4 ${!isModel && 'flex-row-reverse'}`}>
      <div className={`rounded-full p-2 flex-shrink-0 ${isModel ? 'bg-cyan-100 dark:bg-cyan-800 text-cyan-600 dark:text-cyan-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
        {isModel ? <ModelIcon /> : <UserIcon />}
      </div>
              <div className={`max-w-3xl w-full flex flex-col ${!isModel && 'items-end'}`}>
                {isModel && <MessageMetadata responseType={message.responseType} modelId={message.modelId} />}
                <div className={`group relative rounded-lg px-5 py-3 ${isModel ? 'bg-slate-100 dark:bg-slate-800' : 'bg-cyan-600 text-white dark:bg-cyan-700'}`}>
                  {message.attachment && (            <div className="mb-2">
                <AttachmentPreview attachment={message.attachment} onRemove={() => {}} isReadOnly />
            </div>
          )}
          <div>
             {message.content ? (
                <MarkdownRenderer text={message.content} onExportToSheets={onExportToSheets} messageIndex={messageIndex} />
             ) : (
                isModel && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-slate-400 rounded-full inline-block animate-pulse" style={{ animationDelay: '0s' }}></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full inline-block animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full inline-block animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                )
             )}
          </div>
           {isModel && message.content && (
                <button 
                    onClick={handleToggleSpeech} 
                    className="absolute -bottom-4 right-2 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={isSpeaking ? "Stop speaking" : "Read message aloud"}
                >
                    {isSpeaking ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                </button>
            )}
        </div>
        {isModel && message.suggestion && (
            <div className="mt-3 w-full">
                <CodeSuggestionViewer 
                    suggestion={message.suggestion} 
                    onAction={onSuggestionAction}
                />
            </div>
        )}
        {isModel && message.editedFile && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Edited File:</span>
            <SourcePill 
              key={message.editedFile.id} 
              source={message.editedFile} 
              onClick={() => onSelectSource(message.editedFile)}
              isEdited={true} 
            />
          </div>
        )}
        {(hasElasticSources || hasGroundingChunks) && (
          <div className="mt-3 space-y-2">
            <button onClick={() => setIsSourcesOpen(!isSourcesOpen)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full px-3 py-1">
              <span>Sources</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 transition-transform ${isSourcesOpen ? 'rotate-90' : ''}`}>
                <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            <div className={`transition-all duration-500 ease-in-out overflow-y-auto ${isSourcesOpen ? 'max-h-96' : 'max-h-0'}`}>
              <>
                {hasElasticSources && (
                  <div className="flex flex-wrap gap-2 items-center pt-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Sources:</span>
                    {message.sources.map((result, index) => (
                      <SourcePill key={result.source.id} id={`source-${messageIndex}-${index + 1}`} result={result} onClick={() => onSelectSource(result.source)} chunkIndex={index + 1} />
                    ))}
                  </div>
                )}
                {hasGroundingChunks && (
                  <div className="flex flex-wrap gap-2 items-center pt-2">
                     <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Web Results:</span>
                     {message.groundingChunks.map((chunk, index) => {
                        const source = chunk.web || chunk.maps;
                        if (!source || !source.uri) return null;
                        const hostname = source.uri ? new URL(source.uri).hostname.replace('www.', '') : 'source';
                        return (
                          <a 
                            key={index} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full cursor-pointer transition-colors duration-200 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300"
                            title={source.title}
                          >
                            {chunk.web ? <WebIcon /> : <MapIcon />}
                            <span className="truncate max-w-[200px]">{source.title || hostname}</span>
                          </a>
                        )
                     })}
                  </div>
                )}
              </>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
