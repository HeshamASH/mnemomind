import React, { useState, useRef, useEffect } from 'react';
import { ModelId, MODELS } from '../types';
import ModelSwitcherPopover from './ModelSwitcherPopover';

// Re-using the chevron from the old select-based component
const ChevronDownIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-70">
        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
);


interface ModelSwitcherProps {
    selectedModel: ModelId;
    onModelChange: (modelId: ModelId) => void;
    disabled?: boolean;
}

const ModelSwitcher: React.FC<ModelSwitcherProps> = ({ selectedModel, onModelChange, disabled }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const selected = MODELS.find(m => m.id === selectedModel);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isPopoverOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPopoverOpen]);

    return (
        <div className="relative" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setIsPopoverOpen(prev => !prev)}
                disabled={disabled}
                className="flex items-center gap-1.5 text-sm font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-inset ring-cyan-500/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
                aria-label="Select AI Model"
                aria-haspopup="true"
                aria-expanded={isPopoverOpen}
            >
                <span>{selected?.name || 'Select Model'}</span>
                <ChevronDownIcon />
            </button>
            {isPopoverOpen && (
                <ModelSwitcherPopover
                    models={MODELS}
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                    onClose={() => setIsPopoverOpen(false)}
                />
            )}
        </div>
    );
};

export default ModelSwitcher;