import React, { useRef, useState, useCallback } from 'react';
import { DataSource } from '../types';

import GoogleDrivePicker from './GoogleDrivePicker';

interface DataSourceModalProps {
  onClose: () => void;
  onConnect: (files: File[], dataSource: DataSource) => void;
  showGoogleDrivePicker?: boolean;
  onConnectGoogleDrive: (files: DriveFile[], dataSource: DataSource) => void;
}

// --- Icons ---
const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={`w-8 h-8 ${className || ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h19.5v5.25a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V13.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5v-3.375A2.25 2.25 0 0 1 5.25 7.875h13.5A2.25 2.25 0 0 1 21 10.125v3.375" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.875V6.75a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6.75v1.125" />
    </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${className || ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);

const DriveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={`w-8 h-8 ${className || ''}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.158 0a.225.225 0 0 1 .225-.225h.01a.225.225 0 0 1 .225.225v.01a.225.225 0 0 1-.225.225h-.01a.225.225 0 0 1-.225-.225v-.01Z" />
    </svg>
);

const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={`w-8 h-8 ${className || ''}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5-1.125v.113" />
    </svg>
);



const DataSourceModal: React.FC<DataSourceModalProps> = ({ onClose, onConnect, showGoogleDrivePicker, onConnectGoogleDrive }) => {
    const folderInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'folder' | 'files') => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const name = type === 'folder' 
            ? (files[0] as any).webkitRelativePath.split('/')[0] || 'Project Folder'
            : `${files.length} file${files.length > 1 ? 's' : ''}`;
        
        const dataSource: DataSource = {
            type,
            name,
            fileCount: files.length,
        };
        onConnect(files, dataSource);
    }, [onConnect]);

    if (showGoogleDrivePicker) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                    <GoogleDrivePicker onConnect={onConnectGoogleDrive} onClose={onClose} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Connect a Data Source</h2>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close">
                        <CloseIcon />
                    </button>
                </header>
                <main className="p-6">
                    <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">
                        Select a source to begin a new chat session. The AI will use this data as its primary context.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Folder Upload */}
                        <button
                            onClick={() => folderInputRef.current?.click()}
                            className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <FolderIcon className="text-cyan-600 dark:text-cyan-400 mb-3" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Upload Folder</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Codebases, projects, etc.</p>
                        </button>
                        <input type="file" ref={folderInputRef} onChange={(e) => handleFileChange(e, 'folder')} className="hidden" multiple {...{ webkitdirectory: "true" }} />

                        {/* Files Upload */}
                        <button
                             onClick={() => filesInputRef.current?.click()}
                            className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <FileIcon className="text-cyan-600 dark:text-cyan-400 mb-3" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Upload Files</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">PDFs, .txt, .md, etc.</p>
                        </button>
                        <input type="file" ref={filesInputRef} onChange={(e) => handleFileChange(e, 'files')} className="hidden" multiple accept=".pdf,.txt,.md,.html,.json,.js,.ts,.py,.css" />

                        {/* Google Drive */}
                         <button 
                            onClick={() => window.location.href = '/api/auth/google'}
                            className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                         >
                            <DriveIcon className="text-cyan-600 dark:text-cyan-400 mb-3" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Connect Google Drive</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Docs, Sheets, etc.</p>
                        </button>
                        
                        {/* Database - Mock */}
                        <button className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 transition-colors opacity-50 cursor-not-allowed">
                            <DatabaseIcon className="text-slate-500 dark:text-slate-400 mb-3" />
                            <h3 className="font-semibold text-slate-600 dark:text-slate-400">SQL Database</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-500">Coming Soon</p>
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DataSourceModal;