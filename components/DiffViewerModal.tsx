
import React, { useState, useMemo } from 'react';
import { Source } from '../types';

interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

type DiffViewMode = 'split' | 'unified';

interface DiffLine {
    type: 'add' | 'remove' | 'same';
    text: string;
}

interface SplitDiffLine {
    left?: { type: 'remove' | 'same'; text: string; };
    right?: { type: 'add' | 'same'; text: string; };
}

// --- Diff Calculation Logic ---

const createUnifiedDiff = (original: string, suggested: string): DiffLine[] => {
    // This is a simplified version of the LCS-based diff algorithm for unified view.
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const dp = Array(originalLines.length + 1).fill(null).map(() => Array(suggestedLines.length + 1).fill(0));
    for (let i = 1; i <= originalLines.length; i++) {
        for (let j = 1; j <= suggestedLines.length; j++) {
            if (originalLines[i - 1] === suggestedLines[j - 1]) dp[i][j] = 1 + dp[i - 1][j - 1];
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    let i = originalLines.length, j = suggestedLines.length;
    const diff: DiffLine[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            diff.unshift({ type: 'same', text: `  ${originalLines[i - 1]}` }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ type: 'add', text: `+ ${suggestedLines[j - 1]}` }); j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            diff.unshift({ type: 'remove', text: `- ${originalLines[i - 1]}` }); i--;
        } else break;
    }
    return diff;
};

const createSplitDiff = (original: string, suggested: string): SplitDiffLine[] => {
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const dp = Array(originalLines.length + 1).fill(null).map(() => Array(suggestedLines.length + 1).fill(0));
    for (let i = 1; i <= originalLines.length; i++) {
        for (let j = 1; j <= suggestedLines.length; j++) {
            if (originalLines[i - 1] === suggestedLines[j - 1]) dp[i][j] = 1 + dp[i - 1][j - 1];
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    let i = originalLines.length;
    let j = suggestedLines.length;
    const diff: SplitDiffLine[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            diff.unshift({
                left: { type: 'same', text: originalLines[i - 1] },
                right: { type: 'same', text: suggestedLines[j - 1] },
            });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ right: { type: 'add', text: suggestedLines[j - 1] } });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            diff.unshift({ left: { type: 'remove', text: originalLines[i - 1] } });
            i--;
        } else {
            break;
        }
    }
    return diff;
};


// --- Icons ---

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// --- Component ---

interface DiffViewerModalProps {
  record: EditedFileRecord;
  onClose: () => void;
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ record, onClose }) => {
    const [viewMode, setViewMode] = useState<DiffViewMode>('split');
    const unifiedDiff = useMemo(() => createUnifiedDiff(record.originalContent, record.currentContent), [record]);
    const splitDiff = useMemo(() => createSplitDiff(record.originalContent, record.currentContent), [record]);

    const getUnifiedLineClass = (type: DiffLine['type']) => {
        switch (type) {
            case 'add': return 'bg-green-100 dark:bg-green-900/40';
            case 'remove': return 'bg-red-100 dark:bg-red-900/40';
            default: return '';
        }
    };
    
    const getSplitLineClass = (side: 'left' | 'right', line?: { type: 'add' | 'remove' | 'same' }) => {
        if (!line) return 'bg-slate-100/50 dark:bg-slate-800/20';
        if (line.type === 'remove' && side === 'left') return 'bg-red-100 dark:bg-red-900/40';
        if (line.type === 'add' && side === 'right') return 'bg-green-100 dark:bg-green-900/40';
        return '';
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Changes for {record.file.file_name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{record.file.path}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded-lg p-1 text-sm font-semibold">
                            <button onClick={() => setViewMode('split')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'split' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-300'}`}>Split</button>
                            <button onClick={() => setViewMode('unified')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'unified' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-300'}`}>Unified</button>
                        </div>
                        <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close diff viewer">
                            <CloseIcon />
                        </button>
                    </div>
                </header>
                <main className="flex-1 overflow-auto font-mono text-sm">
                    {viewMode === 'unified' && (
                        <pre className="p-4">
                            <code>
                                {unifiedDiff.map((line, index) => (
                                    <div key={index} className={`whitespace-pre-wrap ${getUnifiedLineClass(line.type)}`}>
                                        {line.text}
                                    </div>
                                ))}
                            </code>
                        </pre>
                    )}
                    {viewMode === 'split' && (
                        <div className="grid grid-cols-2">
                           <div className="border-r border-slate-200 dark:border-slate-700/50">
                               <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 p-2 font-sans font-semibold text-center text-slate-700 dark:text-slate-300">Original</div>
                               <pre className="p-4">
                                   <code>
                                       {splitDiff.map((line, index) => (
                                           <div key={index} className={`whitespace-pre-wrap ${getSplitLineClass('left', line.left)}`}>
                                               {line.left ? ` ${line.left.text}` : ' '}
                                           </div>
                                       ))}
                                   </code>
                               </pre>
                           </div>
                           <div>
                                <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 p-2 font-sans font-semibold text-center text-slate-700 dark:text-slate-300">Current</div>
                                <pre className="p-4">
                                   <code>
                                       {splitDiff.map((line, index) => (
                                           <div key={index} className={`whitespace-pre-wrap ${getSplitLineClass('right', line.right)}`}>
                                               {line.right ? ` ${line.right.text}` : ' '}
                                           </div>
                                       ))}
                                   </code>
                                </pre>
                           </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DiffViewerModal;
