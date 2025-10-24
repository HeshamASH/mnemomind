import React from 'react';
import { Attachment } from '../types';

interface AttachmentPreviewProps {
    attachment: Attachment;
    onRemove: () => void;
    isReadOnly?: boolean;
}

// FIX: Update icon to accept a className prop.
const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className || ''}`}>
        <path fillRule="evenodd" d="M15.625 2.5h-7.852a.75.75 0 0 0-.566.25l-4.333 5A.75.75 0 0 0 3 8.352V17.5A1.5 1.5 0 0 0 4.5 19h11A1.5 1.5 0 0 0 17 17.5V4A1.5 1.5 0 0 0 15.5 2.5h.125Zm-3.625 0V7.5h5V4.375A1.875 1.875 0 0 0 15.125 2.5h-3.125Z" clipRule="evenodd" />
        <path d="M9.06 3.28a.75.75 0 0 1 .566-.25h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.566-.25Z" />
    </svg>
);


const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
);


const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, onRemove, isReadOnly = false }) => {
    const isImage = attachment.type.startsWith('image/');
    const fileSize = (attachment.size / 1024).toFixed(1);

    return (
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-200 dark:bg-slate-700/50 mb-3 ${isReadOnly ? '' : 'border border-slate-300 dark:border-slate-600'}`}>
            {isImage ? (
                <img src={`data:${attachment.type};base64,${attachment.content}`} alt={attachment.name} className="w-10 h-10 object-cover rounded" />
            ) : (
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-300 dark:bg-slate-600 rounded">
                    <FileIcon className="text-slate-600 dark:text-slate-300" />
                </div>
            )}
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{attachment.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fileSize} KB</p>
            </div>
            {!isReadOnly && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="flex-shrink-0 p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                    aria-label="Remove attachment"
                >
                    <CloseIcon />
                </button>
            )}
        </div>
    );
};

export default AttachmentPreview;