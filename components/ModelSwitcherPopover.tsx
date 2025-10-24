import React from 'react';
import { ModelId, ModelDefinition } from '../types';

const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-cyan-600 dark:text-cyan-400">
        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
);

interface ModelSwitcherPopoverProps {
    models: ModelDefinition[];
    selectedModel: ModelId;
    onModelChange: (modelId: ModelId) => void;
    onClose: () => void;
}

const ModelSwitcherPopover: React.FC<ModelSwitcherPopoverProps> = ({ models, selectedModel, onModelChange, onClose }) => {
    
    const handleSelect = (modelId: ModelId) => {
        onModelChange(modelId);
        onClose();
    };

    return (
        <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 z-10">
            <ul>
                {models.map(model => (
                    <li key={model.id}>
                        <button
                            onClick={() => handleSelect(model.id)}
                            className="w-full flex items-center justify-between text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                            <span>{model.name}</span>
                            {selectedModel === model.id && <CheckIcon />}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ModelSwitcherPopover;