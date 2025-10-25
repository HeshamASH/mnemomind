import React, { useMemo, useState } from 'react';
import { Source } from '../types';
import { FaFilePdf, FaFileCode, FaFileAlt, FaFileImage, FaPython, FaJs, FaHtml5, FaCss3, FaJson, FaMarkdown } from 'react-icons/fa';

// --- Icons ---

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 ${className || ''}`}>
        <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
);

const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-cyan-600 dark:text-cyan-500">
        <path d={isOpen 
            ? "M3.75 3.5A1.25 1.25 0 0 0 2.5 4.75v.283c0 .337.104.66.29.933l.92 1.379a.75.75 0 0 0 .64.355h8.3c.252 0 .487-.123.64-.355l.92-1.379a1.25 1.25 0 0 0 .29-.933V4.75A1.25 1.25 0 0 0 12.25 3.5h-8.5Z" 
            : "M3.75 3.5A1.25 1.25 0 0 0 2.5 4.75v7.5c0 .69.56 1.25 1.25 1.25h8.5A1.25 1.25 0 0 0 13.5 12.25v-7.5A1.25 1.25 0 0 0 12.25 3.5h-8.5Z"} />
        <path d="M2.5 8.75V12.25a.25.25 0 0 0 .25.25h10.5a.25.25 0 0 0 .25-.25V8.75A.25.25 0 0 0 13.25 8.5H2.75a.25.25 0 0 0-.25.25Z" />
    </svg>
);

const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return <FaJs className="w-4 h-4 text-yellow-500" />;
        case 'py':
            return <FaPython className="w-4 h-4 text-blue-500" />;
        case 'html':
            return <FaHtml5 className="w-4 h-4 text-orange-500" />;
        case 'css':
        case 'scss':
        case 'less':
            return <FaCss3 className="w-4 h-4 text-blue-400" />;
        case 'json':
            return <FaFileCode className="w-4 h-4 text-green-500" />;
        case 'md':
            return <FaMarkdown className="w-4 h-4 text-gray-500" />;
        case 'pdf':
            return <FaFilePdf className="w-4 h-4 text-red-500" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
            return <FaFileImage className="w-4 h-4 text-purple-500" />;
        case 'txt':
            return <FaFileAlt className="w-4 h-4 text-gray-500" />;
        default:
            return <FaFileCode className="w-4 h-4 text-gray-500" />;
    }
};


// --- Data Structure ---

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  source?: Source;
  children: TreeNode[];
}

let nodeId = 0;
const buildFileTree = (files: Source[]): TreeNode[] => {
  const root: TreeNode = { name: 'root', type: 'folder', path: '', children: [] };

  files.forEach(file => {
    const pathParts = file.path ? file.path.split('/').filter(p => p) : [];
    let currentNode = root;

    pathParts.forEach(part => {
      let childNode = currentNode.children.find(child => child.name === part && child.type === 'folder');
      if (!childNode) {
        childNode = { 
          name: part,
          type: 'folder',
          path: currentNode.path ? `${currentNode.path}/${part}` : part,
          children: [],
        };
        currentNode.children.push(childNode);
      }
      currentNode = childNode;
    });

    currentNode.children.push({
      name: file.fileName,
      type: 'file',
      path: file.path ? `${file.path}/${file.fileName}` : file.fileName,
      source: file,
      children: [],
    });
  });
  
  // Add unique IDs to each node
  const addIds = (node: TreeNode) => {
    node.id = node.source?.id || `node-${nodeId++}`;
    node.children.forEach(addIds);
  };
  addIds(root);

  // Sort children at each level: folders first, then files, all alphabetically
  const sortChildren = (node: TreeNode) => {
    if (node.children.length > 0) {
      node.children.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root.children;
};

// --- Recursive Tree Node Component ---

const TreeNodeComponent: React.FC<{ node: TreeNode; onSelectFile: (file: Source) => void; depth: number }> = ({ node, onSelectFile, depth }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isFolder = node.type === 'folder';

    const handleToggle = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
        }
    };
    
    const handleSelect = () => {
        if (!isFolder && node.source) {
            onSelectFile(node.source);
        }
    };

    const indentStyle = { paddingLeft: `${depth * 1}rem` };

    return (
        <li>
            <div
                className="flex items-center p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors text-sm"
                style={indentStyle}
                onClick={isFolder ? handleToggle : handleSelect}
            >
                {isFolder ? (
                   <>
                     <ChevronRightIcon className={`mr-1 flex-shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                     <FolderIcon isOpen={isOpen} />
                   </>
                ) : (
                    <div className="mr-1 flex-shrink-0">{getFileIcon(node.name)}</div>
                )}
                <span className="ml-2 text-slate-700 dark:text-slate-300 truncate" title={node.name}>
                    {node.name}
                </span>
            </div>
            {isFolder && isOpen && (
                <ul className="pl-2">
                    {node.children.map(child => (
                        <TreeNodeComponent key={child.id} node={child} onSelectFile={onSelectFile} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
};


// --- Main File Tree Component ---

interface FileTreeProps {
  files: Source[];
  onSelectFile: (file: Source) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ files, onSelectFile }) => {
  const tree = useMemo(() => buildFileTree(files), [files]);

  if (files.length === 0) {
    return <p className="px-3 text-sm text-center text-slate-500">No files found in data source.</p>;
  }

  return (
    <nav>
        <ul>
            {tree.map(node => (
                <TreeNodeComponent key={node.path} node={node} onSelectFile={onSelectFile} depth={0} />
            ))}
        </ul>
    </nav>
  );
};

export default FileTree;