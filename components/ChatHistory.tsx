import React, { useState } from 'react';
import { Chat, DataSource, Source } from '../types';
import FileTree from './FileTree';

interface ChatHistoryProps {
    chats: Chat[];
    activeChatId: string | null;
    onSelectChat: (id: string) => void;
    onNewChat: () => void;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    isOpen: boolean;
    files: Source[];
    onSelectFile: (file: Source) => void;
    activeDataSource: DataSource | null;
}

// --- Icons ---
const NewChatIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const ChatBubbleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${className || ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.794 9 8.25Z" />
    </svg>
);


const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);


const ChatHistory: React.FC<ChatHistoryProps> = ({ chats, activeChatId, onSelectChat, onNewChat, setChats, isOpen, files, onSelectFile, activeDataSource }) => {
    
    const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        setChats(prev => {
            const newChats = prev.filter(chat => chat.id !== chatId);
            if (activeChatId === chatId) {
                if (newChats.length > 0) {
                    onSelectChat(newChats[0].id);
                } else {
                    onNewChat();
                }
            }
            return newChats;
        });
    };
    
    return (
        <aside className={`bg-slate-100/80 dark:bg-slate-950/60 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-0'}`} style={{ overflow: 'hidden' }}>
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors duration-200"
                    aria-label="New chat"
                >
                    <NewChatIcon />
                    <span>New Chat</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                    <nav>
                        <ul>
                            {chats.map(chat => (
                                <li key={chat.id}>
                                    <a
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); onSelectChat(chat.id); }}
                                        className={`flex items-center justify-between p-2.5 rounded-md transition-colors group ${activeChatId === chat.id ? 'bg-cyan-100 dark:bg-cyan-900/50' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <ChatBubbleIcon className={`flex-shrink-0 ${activeChatId === chat.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-500'}`} />
                                            <span className={`text-sm font-medium truncate ${activeChatId === chat.id ? 'text-cyan-800 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {chat.title}
                                            </span>
                                        </div>
                                        <button 
                                          onClick={(e) => handleDeleteChat(e, chat.id)}
                                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity p-1 rounded-md"
                                          aria-label={`Delete chat: ${chat.title}`}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                {(files.length > 0 || activeDataSource) && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <FileTree
                        files={files}
                        onSelectFile={onSelectFile}
                        activeDataSource={activeDataSource}
                      />
                    </div>
                  )}
            </div>
        </aside>
    );
};

export default ChatHistory;
