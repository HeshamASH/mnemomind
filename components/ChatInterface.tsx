    import React, { useState, useRef, useEffect, useCallback } from 'react';
    import {
        ChatMessage, Source, ModelId, Attachment, MessageRole,
        GroundingOptions, ElasticResult, Chat // Added ElasticResult, Chat
    } from '../types';
    import Message from './Message';
    import ModelSwitcher from './ModelSwitcher';
    import AttachmentPreview from './AttachmentPreview';
    import ToolsPopover from './ToolsPopover';
    import { blobToBase64 } from '../utils/fileUtils';
    import ErrorBoundary from './ErrorBoundary';

    // --- Welcome Block ---
    const WelcomeBlock: React.FC<{onConnectDataSource: () => void;}> = ({ onConnectDataSource }) => {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="max-w-xl">
                    {/* Icon */}
                    <div className="mx-auto bg-gradient-to-r from-cyan-500 to-blue-500 p-3 rounded-xl inline-block mb-6 shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                        </svg>
                    </div>
                    {/* Text */}
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">Welcome to MnemoMind</h2>
                    <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mb-8">
                       Connect a data source (like code folders, documents, or Google Drive) to begin asking questions and getting AI-powered insights.
                    </p>
                    {/* Button */}
                    <button
                        onClick={onConnectDataSource}
                        className="bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-cyan-500 transition-colors duration-200 shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        aria-label="Connect Data Source"
                    >
                        Connect Data Source
                    </button>
                </div>
            </div>
        );
    };


    // --- Icons ---
    const SendIcon: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg> );
    const PlusIcon: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg> );
    const ToolsIcon: React.FC = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg> );
    const MicIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${className || ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg> );
    const ShrinkIcon: React.FC<{ onClick: () => void; }> = ({ onClick }) => ( <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"><path fillRule="evenodd" d="M12.79 7.21a.75.75 0 0 1 .02-1.06l3.25-3.25a.75.75 0 0 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06-.02ZM7.21 12.79a.75.75 0 0 1-1.06.02l-3.25-3.25a.75.75 0 1 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 .02 1.06Zm5.58 1.06a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 0 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06ZM2.94 17.06a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" /></svg> );

    // --- Main Chat Interface ---

    interface ChatInterfaceProps {
        messages: ChatMessage[];
        isLoading: boolean;
        onSendMessage: (query: string, attachment?: Attachment) => void;
        onSelectSourceChunk: (result: ElasticResult) => void; // Handler for clicking source pills/citations
        onSelectSource: (source: Source) => void; // Handler for "Show Full Document"
        onSuggestionAction: (messageIndex: number, action: 'accepted' | 'rejected') => void;
        onExportToSheets: (tableData: (string | null)[][]) => void;
        selectedModel: ModelId;
        onModelChange: (modelId: ModelId) => void;
        activeChat: Chat | undefined; // Receive activeChat object
        onConnectDataSource: () => void;
        isCodeGenerationEnabled: boolean;
        onToggleCodeGeneration: () => void;
        groundingOptions?: GroundingOptions; // Use optional chaining for safety
        onGroundingOptionsChange: (options: GroundingOptions) => void;
        apiError: string | null;
        setApiError: (error: string | null) => void; // Add setter prop
        cloudSearchError: string | null;
        shouldAutoScroll?: boolean; // Prop to control auto-scroll
    }

    const ChatInterface: React.FC<ChatInterfaceProps> = ({
        messages,
        isLoading,
        onSendMessage,
        onSelectSourceChunk, // Use this handler
        onSelectSource,      // Keep this for full doc view from ChunkViewer
        onSuggestionAction,
        onExportToSheets,
        selectedModel,
        onModelChange,
        activeChat, // Use the prop
        onConnectDataSource,
        isCodeGenerationEnabled,
        onToggleCodeGeneration,
        groundingOptions, // Now correctly received as a prop
        onGroundingOptionsChange,
        apiError,
        setApiError, // Use the prop
        cloudSearchError,
        shouldAutoScroll = true, // Default to true
    }) => {
        // --- State ---
        const [input, setInput] = useState('');
        const [attachment, setAttachment] = useState<Attachment | null>(null);
        const [isListening, setIsListening] = useState(false);
        const [isToolsPopoverOpen, setIsToolsPopoverOpen] = useState(false);
        const [isExpanded, setIsExpanded] = useState(false);

        // --- Refs ---
        const messageListRef = useRef<HTMLDivElement>(null); // Ref for the scrollable message list div
        const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for the sentinel div at the bottom
        const recognitionRef = useRef<any>(null); // Speech recognition instance
        const fileInputRef = useRef<HTMLInputElement>(null); // File input element
        const textareaRef = useRef<HTMLTextAreaElement>(null); // Textarea element
        const toolsPopoverRef = useRef<HTMLDivElement>(null); // Ref for the tools popover container div
        const inputAreaContainerRef = useRef<HTMLDivElement>(null); // Ref for the fixed input area container

        // --- Auto Scroll Logic ---
        useEffect(() => {
            const lastMessage = messages?.[messages.length - 1];
            const isUserMessage = lastMessage?.role === MessageRole.USER;
            const messageListEl = messageListRef.current;

            // Function to scroll to bottom smoothly
            const scrollToBottom = () => {
                 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            };

            if (messageListEl) {
                // Only auto-scroll if the prop allows it AND we are near the bottom
                const scrollThreshold = 100; // Pixels from bottom to trigger auto-scroll lock
                const isNearBottom = messageListEl.scrollHeight - messageListEl.scrollTop - messageListEl.clientHeight < scrollThreshold;

                if (isUserMessage) {
                    // Always scroll smoothly after user sends a message
                    scrollToBottom();
                } else if (shouldAutoScroll && isNearBottom) {
                    // Scroll smoothly during AI response only if user is already near the bottom
                     scrollToBottom();
                }
                // If shouldAutoScroll is false, or user has scrolled up, don't auto-scroll
            } else if (isUserMessage || shouldAutoScroll) {
                 // Fallback for initial load or if ref not ready yet
                 setTimeout(scrollToBottom, 0); // Use timeout to wait for render
            }
        }, [messages, isLoading, shouldAutoScroll]); // Re-run when messages update or loading state changes


        // --- Other Hooks and Handlers (Keep implementations as is) ---
        const handleResizeTextarea = useCallback(() => { /* ... keep implementation ... */ const textarea = textareaRef.current; if (textarea) { textarea.style.height = 'auto'; const scrollHeight = textarea.scrollHeight; const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24; const maxLines = 10; const maxHeight = lineHeight * maxLines + (textarea.offsetHeight - textarea.clientHeight); if (scrollHeight > maxHeight) { textarea.style.height = `${maxHeight}px`; textarea.style.overflowY = 'auto'; } else { textarea.style.height = `${scrollHeight}px`; textarea.style.overflowY = 'hidden'; } setIsExpanded(scrollHeight > lineHeight * 1.5); } }, []);
        useEffect(() => { handleResizeTextarea(); }, [input, handleResizeTextarea]);
        useEffect(() => { /* Speech recognition setup */ const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (SpeechRecognition) { const recognition = new SpeechRecognition(); recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US'; recognition.onresult = (event: any) => { setInput(event.results[0][0].transcript); }; recognition.onend = () => setIsListening(false); recognition.onerror = (event: any) => { console.error('Speech recognition error:', event.error); setIsListening(false); setApiError(`Mic Error: ${event.error}`); }; recognitionRef.current = recognition; } else { console.warn("Speech Recognition not supported."); } }, [setApiError]); // Added setApiError dependency
        useEffect(() => { /* Popover outside click */ const handleClickOutside = (event: MouseEvent) => { if (isToolsPopoverOpen && toolsPopoverRef.current && !toolsPopoverRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('button[aria-label="Open tools menu"]') ) { setIsToolsPopoverOpen(false); } }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, [isToolsPopoverOpen]);
        const handleToggleListening = () => { /* ... keep implementation ... */ if (!recognitionRef.current) { setApiError("Speech recognition not supported."); return; } if (isListening) { recognitionRef.current?.stop(); setIsListening(false); } else { try { recognitionRef.current?.start(); setIsListening(true); } catch (err) { console.error("Error starting speech recognition:", err); setApiError(`Mic start error: ${err instanceof Error ? err.message : 'Unknown'}`); setIsListening(false); } } };
        const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... keep implementation ... */ const file = event.target.files?.[0]; if (file) { try { if (file.size > 5 * 1024 * 1024) { throw new Error("File size exceeds 5MB limit."); } const base64Content = await blobToBase64(file); setAttachment({ name: file.name, type: file.type, size: file.size, content: base64Content, }); setApiError(null); } catch (error) { console.error("Error attaching file:", error); setApiError(error instanceof Error ? error.message : "Failed to attach file."); setAttachment(null); } } if (event.target) event.target.value = ''; };
        const handleSubmit = (e: React.FormEvent) => { /* ... keep implementation ... */ e.preventDefault(); if (isLoading) return; if (input.trim() || attachment) { onSendMessage(input, attachment ?? undefined); setInput(''); setAttachment(null); if (textareaRef.current) { textareaRef.current.style.height = 'auto'; } setIsExpanded(false); } };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { /* ... keep implementation ... */ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } };
        const handleShrink = () => { /* ... keep implementation ... */ if (textareaRef.current) { textareaRef.current.style.height = 'auto'; setIsExpanded(false); handleResizeTextarea(); } };


        // --- Render ---
        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative"> {/* Use flex-col and relative */}
                {/* Message List Area */}
                <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-32"> {/* Added more padding-bottom */}
                    {/* Welcome or Messages */}
                    {!activeChat?.dataSource && messages.length === 0 ? (
                        <WelcomeBlock onConnectDataSource={onConnectDataSource} />
                    ) : (
                        <div className="space-y-6 max-w-4xl mx-auto w-full"> {/* Center content */}
                            {messages.map((msg, index) => (
                                <ErrorBoundary key={msg.id || index}> {/* Use a more stable key if available */}
                                    <Message
                                        message={msg}
                                        onSelectSourceChunk={onSelectSourceChunk} // Pass handler for chunk view
                                        onSelectSource={onSelectSource} // Pass handler for full doc view
                                        onSuggestionAction={(action) => onSuggestionAction(index, action)}
                                        onExportToSheets={onExportToSheets}
                                    />
                                </ErrorBoundary>
                            ))}
                            {/* Loading Indicator for Model Response */}
                            {isLoading && messages[messages.length - 1]?.role === MessageRole.USER && (
                                 <ErrorBoundary key="loading">
                                    <Message
                                        message={{ role: MessageRole.MODEL, content: '' }} // Placeholder
                                        onSelectSourceChunk={() => {}}
                                        onSelectSource={() => {}}
                                        onSuggestionAction={() => {}}
                                        onExportToSheets={onExportToSheets}
                                    />
                                 </ErrorBoundary>
                            )}
                            {/* Sentinel element for scrolling */}
                            <div ref={messagesEndRef} className="h-px" />
                        </div>
                    )}
                </div>

                {/* Input Area Container - Fixed at the bottom */}
                <div
                    ref={inputAreaContainerRef}
                    className="absolute bottom-0 left-0 right-0 z-10 px-4 sm:px-6 py-3 bg-gradient-to-t from-white dark:from-slate-900 via-white/90 dark:via-slate-900/90 to-transparent pointer-events-none" // Gradient background
                >
                    {/* Error Display */}
                    {apiError && (
                        <div className="w-full max-w-4xl mx-auto mb-2 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm font-semibold pointer-events-auto flex justify-between items-center" role="alert">
                           <span>{apiError}</span>
                           <button onClick={() => setApiError(null)} className="ml-2 text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100 p-1 rounded-full focus:outline-none focus:ring-1 focus:ring-red-500">&times;</button>
                        </div>
                    )}
                    {/* Input Form Container - Centered */}
                    <div className="w-full max-w-4xl mx-auto pointer-events-auto"> {/* Centered */}
                        <div className="relative p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-lg"> {/* Input box styling */}
                            <form onSubmit={handleSubmit}>
                                {/* Attachment Preview (if any) */}
                                {attachment && (
                                    <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />
                                )}
                                {/* Textarea and Shrink Icon */}
                                <div className="relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isListening ? "Listening..." : (isLoading ? "Generating..." : "Ask Gemini...")}
                                        className="w-full pl-1 pr-8 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none resize-none overflow-y-hidden text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-70"
                                        rows={1}
                                        disabled={isLoading}
                                        aria-label="Chat input"
                                    />
                                    {isExpanded && (
                                        <div className="absolute top-1 right-1">
                                            <ShrinkIcon onClick={handleShrink} aria-label="Shrink chat input" />
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Controls Row */}
                                <div className="flex items-center justify-between mt-2">
                                    {/* Left Controls */}
                                    <div className="flex items-center gap-1" ref={toolsPopoverRef}>
                                        {/* Attach Button */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isLoading || !!attachment}
                                            className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Attach file"
                                        >
                                            <PlusIcon />
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.css" />

                                        {/* Tools Button & Popover */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsToolsPopoverOpen(prev => !prev)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg px-2 py-2 disabled:opacity-50 transition-colors"
                                                aria-label="Open tools menu" aria-haspopup="true" aria-expanded={isToolsPopoverOpen}
                                            >
                                                <ToolsIcon />
                                                <span className="hidden sm:inline">Tools</span>
                                            </button>
                                            {isToolsPopoverOpen && groundingOptions && activeChat && ( // Ensure activeChat exists for hasPreloadedDataSource check
                                                <ToolsPopover
                                                    isCodeGenerationEnabled={isCodeGenerationEnabled}
                                                    onToggleCodeGeneration={onToggleCodeGeneration}
                                                    groundingOptions={groundingOptions}
                                                    onGroundingOptionsChange={onGroundingOptionsChange}
                                                    hasPreloadedDataSource={!!activeChat.dataSource} // Check dataSource on activeChat
                                                    cloudSearchError={cloudSearchError}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {/* Right Controls */}
                                    <div className="flex items-center gap-2">
                                        <ModelSwitcher selectedModel={selectedModel} onModelChange={onModelChange} disabled={isLoading} />
                                        {/* Send or Mic Button */}
                                        {(input.trim() || attachment) ? (
                                            <button
                                                type="submit" disabled={isLoading} aria-label="Send message"
                                                className="bg-cyan-600 text-white rounded-lg p-2 hover:bg-cyan-500 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                                            > <SendIcon /> </button>
                                         ) : recognitionRef.current && (
                                            <button
                                                type="button" onClick={handleToggleListening} disabled={isLoading}
                                                aria-label={isListening ? "Stop listening" : "Use microphone"}
                                                className={`p-2 rounded-lg disabled:opacity-50 transition-colors ${isListening ? 'text-cyan-500 bg-slate-100 dark:bg-slate-700 animate-pulse' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                            > <MicIcon /> </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    export default ChatInterface;
    

