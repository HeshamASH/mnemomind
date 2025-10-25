
import React, { useState, useEffect } from 'react';
import { DataSource, DriveFile } from '../types';

interface GoogleDrivePickerProps {
  onConnect: (files: DriveFile[], dataSource: DataSource) => void;
  onClose: () => void;
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({ onConnect, onClose }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/drive/files');
        if (!response.ok) {
          throw new Error('Failed to fetch Google Drive files');
        }
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchFiles();
  }, []);

  const handleFileToggle = (file: DriveFile) => {
    setSelectedFiles(prev => 
      prev.some(f => f.id === file.id) 
        ? prev.filter(f => f.id !== file.id) 
        : [...prev, file]
    );
  };

  const handleConnect = () => {
    const dataSource: DataSource = {
      type: 'drive',
      name: `${selectedFiles.length} Google Drive file${selectedFiles.length > 1 ? 's' : ''}`,
      fileCount: selectedFiles.length,
    };
    onConnect(selectedFiles, dataSource);
  };

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Select Google Drive Files</h3>
      <div className="max-h-64 overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-md p-2 mb-4">
        {files.map(file => (
          <div key={file.id} className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
            <input 
              type="checkbox" 
              id={file.id} 
              checked={selectedFiles.some(f => f.id === file.id)}
              onChange={() => handleFileToggle(file)}
              className="mr-3"
            />
            <label htmlFor={file.id} className="flex-grow">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-slate-500">{file.mimeType}</p>
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-end space-x-3">
        <button onClick={onClose} className="px-4 py-2 rounded-md text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
        <button 
          onClick={handleConnect} 
          disabled={selectedFiles.length === 0}
          className="px-4 py-2 rounded-md text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          Connect {selectedFiles.length} file{selectedFiles.length !== 1 && 's'}
        </button>
      </div>
    </div>
  );
};

export default GoogleDrivePicker;
