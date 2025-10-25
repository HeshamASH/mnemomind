import React from 'react';
import { Source, ElasticResult } from '../types';

interface ChunkViewerModalProps {
  result: ElasticResult;
  onClose: () => void;
  onShowFullDocument: (source: Source) => void;
}

// Re-use CloseIcon from FileViewer or define it here
const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const DocumentIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${className || ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);


const ChunkViewerModal: React.FC<ChunkViewerModalProps> = ({ result, onClose, onShowFullDocument }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
      onClick={onClose} // Close on backdrop click
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()} // Prevent close on modal click
      >
        {/* Header */}
        <header className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          <div className="overflow-hidden mr-4">
             <h3 className="font-semibold text-base text-slate-700 dark:text-slate-300">Cited Chunk From:</h3>
            <p className="text-sm text-cyan-600 dark:text-cyan-400 font-mono truncate" title={result.source.path ? `${result.source.path}/${result.source.file_name}` : result.source.file_name}>
                {result.source.file_name}
            </p>
             {/* Display Relevance Score */}
             <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Relevance Score: {result.score.toFixed(4)}
             </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0"> {/* Ensure buttons don't wrap */}
            <button
              onClick={() => onShowFullDocument(result.source)}
              className="flex items-center text-sm font-medium px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap" // Added whitespace-nowrap
            >
              <DocumentIcon className="mr-1.5" /> {/* Added class */}
              Show Full Document
            </button>
            <button onClick={onClose} className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close chunk viewer">
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-800/40"> {/* Added background */}
            {/* Using a div instead of pre for potential richer formatting later, but keeping monospace and whitespace */}
            <div className="bg-white dark:bg-slate-900 rounded-md p-4 text-sm font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-700 shadow-sm"> {/* Added shadow */}
                 {result.contentSnippet || "[No content snippet available]"}
            </div>
        </main>
      </div>
    </div>
  );
};

export default ChunkViewerModal;

