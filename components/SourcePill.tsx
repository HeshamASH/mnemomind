import React from 'react';
import { Source } from '../types';

interface SourcePillProps {
  source: Source;
  onClick: () => void; // Triggered when the pill is clicked
  isEdited?: boolean; // Optional flag for edited files
  citationNumber: number | null; // Citation number (e.g., 1, 2) or null
}

// --- Icons ---
// Generic File Icon
const FileIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 ${className || ''}`}>
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" />
    </svg>
);
// Edit Icon for modified files
const EditIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 ${className || ''}`}>
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.213.213-.46.394-.724.534l-2.651.982a.75.75 0 0 1-.925-.925l.982-2.651c.14-.264.321-.51.534-.724l8.61-8.61Zm.176 2.053-6.646 6.647-.328 1.12.328.328 1.12-.328 6.647-6.646-1.12-1.12Z" />
    </svg>
);

// --- Source Pill Component ---
const SourcePill: React.FC<SourcePillProps> = ({ source, onClick, isEdited = false, citationNumber }) => {

  // Base styling for all pills
  const baseClasses = "flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-200 border whitespace-nowrap overflow-hidden"; // Added border, nowrap, overflow

  // Conditional styling based on state (edited vs. normal)
  const colorClasses = isEdited
    ? "bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800/60 text-green-700 dark:text-green-300" // Greenish for edited files
    : "bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"; // Default slate colors

  // Combine classes
  const combinedClasses = `${baseClasses} ${colorClasses}`;

  // Construct title attribute for hover tooltip
  const title = source.path ? `${source.path}/${source.fileName}` : source.fileName;

  return (
    <button
      onClick={onClick}
      className={combinedClasses}
      title={title} // Show full path or just filename on hover
    >
      {/* Citation Number Bubble */}
      {citationNumber !== null && (
        <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 text-[10px] font-semibold bg-slate-400 dark:bg-slate-500 text-white rounded-full">
            {citationNumber}
        </span>
      )}

      {/* File/Edit Icon */}
      <span className="flex-shrink-0"> {/* Prevent icon from shrinking */}
        {isEdited ? <EditIcon className="text-green-600 dark:text-green-400" /> : <FileIcon className="text-slate-500 dark:text-slate-400" />}
      </span>

      {/* Filename (truncated) */}
      <span className="truncate" style={{ maxWidth: '180px' }}> {/* Limit width and truncate */}
        {source.fileName}
      </span>
    </button>
  );
};

export default SourcePill;

