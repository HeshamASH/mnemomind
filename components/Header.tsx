import React from 'react';
import { Theme, DataSource } from '../types';
import ThemeSwitcher from './ThemeSwitcher';

const SearchIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);

const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

const MenuIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const DataIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
    </svg>
);


interface HeaderProps {
    onToggleFileSearch: () => void;
    onToggleEditedFiles: () => void;
    onToggleSidebar: () => void;
    onConnectDataSource: () => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    activeDataSource: DataSource | null;
}

const Header: React.FC<HeaderProps> = ({ onToggleFileSearch, onToggleEditedFiles, onToggleSidebar, onConnectDataSource, theme, setTheme, activeDataSource }) => {

  return (
    <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <MenuIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">MnemoMind</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">It’s a Mind with a custom Memory.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {activeDataSource && (
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                <DataIcon/>
                <span>{activeDataSource.name} ({activeDataSource.fileCount})</span>
            </div>
        )}
        <button
            onClick={onConnectDataSource}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg border border-cyan-700 dark:border-cyan-600 transition-colors duration-200"
            aria-label="Connect new data source"
        >
            <DataIcon />
            <span>Connect Data Source</span>
        </button>
         <button
            onClick={onToggleFileSearch}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors duration-200"
            aria-label="Search files"
        >
            <SearchIcon />
        </button>
         <button
            onClick={onToggleEditedFiles}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors duration-200"
            aria-label="View edited files"
        >
            <EditIcon />
        </button>
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
      </div>
    </header>
  );
};

export default Header;