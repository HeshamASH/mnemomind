
import React from 'react';
import { ModelId, ModelDefinition, MODELS } from '../types';

const CheckIcon: React.FC = () => (
    <div className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; }> = ({ enabled, onChange }) => (
    <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

interface ModelSwitcherPopoverProps {
    selectedModel: ModelId;
    onModelChange: (modelId: ModelId) => void;
    selectedTeamModel: ModelId;
    onTeamModelChange: (modelId: ModelId) => void;
    onClose: () => void;
    nanoAvailability: string;
    nanoDownloadProgress: number | null;
    useRewriter: boolean;
    onToggleRewriter: () => void;
}

const ModelSwitcherPopover: React.FC<ModelSwitcherPopoverProps> = ({ selectedModel, onModelChange, selectedTeamModel, onTeamModelChange, onClose, nanoAvailability, nanoDownloadProgress, useRewriter, onToggleRewriter }) => {

    const handleSelect = (modelId: ModelId) => {
        onModelChange(modelId);
    };

    const handleTeamSelect = (modelId: ModelId) => {
        onTeamModelChange(modelId);
    };

    const mainBrainModels = MODELS;
    const llmsTeamModels = [ModelId.GEMINI_NANO, ModelId.GEMINI_FLASH_LITE, ModelId.GEMINI_FLASH];

    const openWorkflowFile = () => {
        window.open('/workflow explainer/workflow Mind map.md', '_blank');
    };

    return (
        <div
            className="absolute bottom-full right-0 mb-2 w-80 bg-[#282A2E] border border-slate-700 rounded-xl shadow-2xl z-10 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-switcher-title"
        >
            <div className="space-y-4">
                <div>
                    <h2 className="text-md font-bold text-slate-200">main brain 🧠</h2>
                    <p className="text-sm text-slate-400 mb-3">The model that answers questions.</p>
                    <ul className="space-y-2">
                        {mainBrainModels.map(model => {
                            const isSelected = selectedModel === model.id;
                            const isDisabled = model.id === ModelId.GEMINI_NANO && nanoAvailability === 'unavailable';
                            return (
                                <li key={model.id}>
                                    <button
                                        onClick={() => handleSelect(model.id)}
                                        className={`w-full flex items-center justify-between text-left p-2 rounded-lg transition-colors hover:bg-slate-700/40 ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        disabled={isDisabled}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-200 text-sm">{model.name}</span>
                                            {isDisabled && <span className="text-xs text-slate-400">Not available on this device</span>}
                                        </div>
                                        {isSelected && <CheckIcon />}
                                    </button>
                                     {model.id === ModelId.GEMINI_NANO && nanoDownloadProgress !== null && (
                                        <div className="w-full bg-slate-600 rounded-full h-1.5 mt-1">
                                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${nanoDownloadProgress * 100}%` }}></div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="border-t border-slate-700 pt-4">
                    <h2 className="text-md font-bold text-slate-200">LLMs team that works with the brain</h2>
                    <p className="text-sm text-slate-400 mb-3">The main brain works in a team of Large Language Models (LLM), select their model:</p>
                    <ul className="space-y-2">
                         {MODELS.filter(m => llmsTeamModels.includes(m.id)).map(model => {
                            const isSelected = selectedTeamModel === model.id;
                            const isDisabled = model.id === ModelId.GEMINI_NANO && nanoAvailability === 'unavailable';
                            return (
                                <li key={model.id}>
                                    <button
                                        onClick={() => handleTeamSelect(model.id)}
                                        className={`w-full flex items-center justify-between text-left p-2 rounded-lg transition-colors hover:bg-slate-700/40 ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        disabled={isDisabled}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-200 text-sm">{model.name}</span>
                                            {isDisabled && <span className="text-xs text-slate-400">Not available on this device</span>}
                                        </div>
                                        {isSelected && <CheckIcon />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="border-t border-slate-700 pt-4">
                     <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">Use Rewriter API</label>
                        <ToggleSwitch enabled={useRewriter} onChange={onToggleRewriter} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Use Rewriter API to do the rewriting process.</p>
                </div>

                <div className="border-t border-slate-700 pt-3 text-center">
                    <button onClick={openWorkflowFile} className="text-sm text-blue-400 hover:underline">
                        What is the MnemoMind workflow?
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelSwitcherPopover;
