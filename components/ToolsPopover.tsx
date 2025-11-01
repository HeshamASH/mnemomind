import React from 'react';
import { GroundingOptions } from '../types';

// A simple toggle switch component
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; disabled?: boolean; }> = ({ enabled, onChange, disabled = false }) => {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${enabled ? 'bg-cyan-600' : 'bg-slate-400 dark:bg-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-checked={enabled}
            role="switch"
        >
            <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
};

interface ToolsPopoverProps {
    isCodeGenerationEnabled: boolean;
    onToggleCodeGeneration: () => void;
    groundingOptions: GroundingOptions;
    onGroundingOptionsChange: (options: GroundingOptions) => void;
    hasPreloadedDataSource: boolean;
    cloudSearchError: string | null;
}

const ToolsPopover: React.FC<ToolsPopoverProps> = ({ 
    isCodeGenerationEnabled, 
    onToggleCodeGeneration,
    groundingOptions,
    onGroundingOptionsChange,
    hasPreloadedDataSource,
    cloudSearchError
}) => {
    const handleToggle = (option: keyof GroundingOptions) => {
        onGroundingOptionsChange({ ...groundingOptions, [option]: !groundingOptions[option] });
    };

    const getStatusText = () => {
        const { useCloud, usePreloaded, useGoogleSearch } = groundingOptions;
        const sources = [];
        if (usePreloaded) sources.push('preload');
        if (useCloud) sources.push('cloud files');
        if (useGoogleSearch) sources.push('Google search');

        if (sources.length === 0) return 'status: no grounding source selected';
        return `status: using ${sources.join(' and ')}`;
    };

    return (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 p-3 space-y-3">
            <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Tools</h4>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code Generation</label>
                    <ToggleSwitch enabled={isCodeGenerationEnabled} onChange={onToggleCodeGeneration} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Allow AI to suggest code edits.</p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700"></div>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Grounding Sources</h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{getStatusText()}</span>
                </div>
                
                <div className="space-y-2">
                    {/* Cloud Search */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className={`text-sm font-medium ${groundingOptions.useGoogleSearch ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Cloud Search</label>
                            <ToggleSwitch enabled={groundingOptions.useCloud} onChange={() => handleToggle('useCloud')} disabled={groundingOptions.useGoogleSearch} />
                        </div>
                        {cloudSearchError && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Failed to fetch</p>
                        )}
                    </div>
                    {/* Preloaded Files */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className={`text-sm font-medium ${(hasPreloadedDataSource && !groundingOptions.useGoogleSearch) ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>Preloaded Files</label>
                            <ToggleSwitch 
                                enabled={hasPreloadedDataSource && groundingOptions.usePreloaded} 
                                onChange={() => handleToggle('usePreloaded')}
                                disabled={!hasPreloadedDataSource || groundingOptions.useGoogleSearch}
                            />
                        </div>
                        {!hasPreloadedDataSource && (
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connect a data source to enable.</p>
                        )}
                    </div>
                     {/* Google Search */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Search</label>
                            <ToggleSwitch enabled={groundingOptions.useGoogleSearch} onChange={() => handleToggle('useGoogleSearch')} />
                        </div>
                    </div>
                     {/* Google Maps */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Maps</label>
                            <ToggleSwitch enabled={groundingOptions.useGoogleMaps} onChange={() => handleToggle('useGoogleMaps')} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ToolsPopover;