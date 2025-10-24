    import React, { useMemo, useState, useCallback } from 'react'; // Added useCallback
    import { Source } from '../types';
    // Using react-icons for potentially better consistency
    import {
        FaFilePdf, FaFileCode, FaFileAlt, FaFileImage, FaPython,
        FaJs, FaHtml5, FaCss3, FaMarkdown, FaFolder, FaFolderOpen
    } from 'react-icons/fa';
    import { IoChevronForward } from "react-icons/io5"; // Using a different chevron

    // --- Icons ---
    // Using IoChevronForward for expand/collapse
    const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
        <IoChevronForward className={`w-3.5 h-3.5 ${className || ''}`} />
    );

    // Using FaFolder and FaFolderOpen
    const FolderIcon: React.FC<{ isOpen: boolean; className?: string }> = ({ isOpen, className }) => (
        isOpen
            ? <FaFolderOpen className={`w-4 h-4 text-cyan-600 dark:text-cyan-500 ${className || ''}`} />
            : <FaFolder className={`w-4 h-4 text-cyan-600 dark:text-cyan-500 ${className || ''}`} />
    );

    // getFileIcon using react-icons - Refined
    const getFileIcon = (fileName: string) => {
        const extension = fileName.split('.').pop()?.toLowerCase() || ''; // Handle files with no extension
        const iconClass = "w-4 h-4 flex-shrink-0"; // Common class
        switch (extension) {
            case 'js': case 'jsx': return <FaJs className={`${iconClass} text-yellow-500`} />;
            case 'ts': case 'tsx': return <FaFileCode className={`${iconClass} text-blue-500`} />; // Generic code icon for TS
            case 'py': return <FaPython className={`${iconClass} text-sky-600`} />; // Adjusted color
            case 'html': return <FaHtml5 className={`${iconClass} text-orange-500`} />;
            case 'css': case 'scss': case 'less': case 'sass': return <FaCss3 className={`${iconClass} text-blue-400`} />;
            case 'json': return <FaFileCode className={`${iconClass} text-yellow-600`} />;
            case 'md': return <FaMarkdown className={`${iconClass} text-gray-400`} />;
            case 'pdf': return <FaFilePdf className={`${iconClass} text-red-500`} />;
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return <FaFileImage className={`${iconClass} text-purple-500`} />;
            case 'txt': case '': default: return <FaFileAlt className={`${iconClass} text-gray-500`} />; // Default to text file
        }
    };


    // --- Data Structure ---
    interface TreeNode {
      id: string; // Ensure this is always unique
      name: string;
      type: 'folder' | 'file';
      path: string; // Full path from root
      source?: Source; // Original source object for files
      children: TreeNode[];
    }

    // Global counter for unique node IDs if source ID is missing
    let fallbackNodeIdCounter = 0;

    const buildFileTree = (files: Source[]): TreeNode[] => {
      const treeMap = new Map<string, TreeNode>();
      // Create a virtual root node to simplify logic
      const root: TreeNode = { id: '___root___', name: 'root', type: 'folder', path: '', children: [] };
      treeMap.set('', root); // Map empty path to root

      files.forEach(file => {
        // Sanitize paths and filenames for ID generation if needed (replace invalid chars)
        const sanitizeForId = (str: string) => str.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

        const fileName = file.fileName || 'unknown_file'; // Ensure filename exists
        const filePath = file.path || ''; // Ensure path exists

        const fullPath = filePath ? `${filePath}/${fileName}` : fileName;
        const parentPath = filePath;

        // Ensure parent directories exist by iterating through path parts
        let currentParentNode = root;
        let accumulatedPath = '';
        const pathParts = parentPath.split('/').filter(p => p && p !== '.'); // Filter empty parts and '.'

        pathParts.forEach((part) => {
            accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
            let childNode = treeMap.get(accumulatedPath);
            if (!childNode) {
                // Generate a unique ID for the folder based on its path
                const newNodeId = `folder-${sanitizeForId(accumulatedPath)}-${fallbackNodeIdCounter++}`;
                childNode = {
                    id: newNodeId,
                    name: part,
                    type: 'folder',
                    path: accumulatedPath,
                    children: [],
                };
                treeMap.set(accumulatedPath, childNode);
                currentParentNode.children.push(childNode); // Add to parent's children
            }
            currentParentNode = childNode; // Move down the tree
        });

        // Add the file node to the correct parent
        // Use a combination of path and name for fallback ID, ensuring more uniqueness
        const fileNodeId = file.id || `file-${sanitizeForId(fullPath)}-${fallbackNodeIdCounter++}`;
        const fileNode: TreeNode = {
            id: fileNodeId,
            name: fileName,
            type: 'file',
            path: fullPath, // Store full path for reference/title
            source: file,
            children: [],
        };

        // Prevent adding duplicates based on the generated/provided unique ID
        if (!currentParentNode.children.some(child => child.id === fileNode.id)) {
            currentParentNode.children.push(fileNode);
        } else {
            // This warning indicates a potential issue with source ID generation or duplicates in the input `files` array
            console.warn(`Attempted to add duplicate node ID: ${fileNode.id}. File: ${fullPath}. Skipping.`);
        }
      });

      // Sort children recursively after building the structure
      const sortChildren = (node: TreeNode) => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => {
            // Folders first
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            // Then sort alphabetically by name
            return a.name.localeCompare(b.name);
          });
          node.children.forEach(sortChildren); // Recurse
        }
      };

      sortChildren(root);
      return root.children; // Return children of the virtual root
    };


    // --- Recursive Tree Node Component ---
    // Wrap with React.memo for performance optimization if the tree gets large
    const TreeNodeComponent: React.FC<{ node: TreeNode; onSelectFile: (file: Source) => void; depth: number }> = React.memo(({ node, onSelectFile, depth }) => {
        const [isOpen, setIsOpen] = useState(false);
        const isFolder = node.type === 'folder';

        // Toggle folder open/closed state
        const handleToggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
            e.stopPropagation(); // Prevent triggering parent select/toggle
            if (isFolder) {
                setIsOpen(prev => !prev);
            }
        }, [isFolder]);

        // Select file or toggle folder on main row click/keypress
        const handleSelect = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
            e.stopPropagation();
            if (!isFolder && node.source) {
                onSelectFile(node.source);
            } else if (isFolder) {
                 // Allow clicking anywhere on the folder row (except chevron) to toggle it
                 if ((e.target as HTMLElement).closest('button[aria-label^="Expand"], button[aria-label^="Collapse"]')) {
                     return; // Don't toggle if chevron was clicked (handled by handleToggle)
                 }
                 setIsOpen(prev => !prev);
            }
        }, [isFolder, node.source, onSelectFile]);

        // Indentation style based on depth
        const indentStyle = { paddingLeft: `${depth * 1.25}rem` }; // 1.25rem per level

        return (
            // Use unique node.id as the key
            <li key={node.id}>
                {/* Clickable Row Wrapper */}
                <div
                    className={`flex items-center pl-1 pr-1 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors text-sm group focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900`} // Added focus styles
                    style={indentStyle} // Apply indentation here
                    onClick={handleSelect}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(e); // Trigger select/toggle
                        } else if (isFolder && e.key === 'ArrowRight' && !isOpen) {
                            e.preventDefault(); handleToggle(e); // Expand on Right Arrow
                        } else if (isFolder && e.key === 'ArrowLeft' && isOpen) {
                            e.preventDefault(); handleToggle(e); // Collapse on Left Arrow
                        }
                     }}
                    aria-expanded={isFolder ? isOpen : undefined}
                    title={node.path} // Show full path on hover
                >
                    {/* Folder Specific: Chevron Button + Icon */}
                    {isFolder && (
                        <>
                            <button
                                onClick={handleToggle}
                                className={`p-0.5 rounded mr-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none`} // Removed redundant focus styles here
                                aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                                tabIndex={-1} // Prevent double tabbing
                            >
                               <ChevronRightIcon className={`flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                            <FolderIcon isOpen={isOpen} className="mr-1.5 flex-shrink-0" />
                        </>
                    )}

                     {/* File Specific: Icon (aligned with folder icon) */}
                    {!isFolder && (
                        // Use padding to align with where the chevron *would* be
                        <span className="pl-[calc(0.125rem+0.875rem+0.25rem)] mr-1.5 w-4 inline-flex justify-center items-center flex-shrink-0"> {/* padding-left = (half chevron padding + chevron width + chevron margin-right) */}
                            {getFileIcon(node.name)}
                        </span>
                     )}

                    {/* Name (Truncated) */}
                    <span className="text-slate-700 dark:text-slate-300 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400" >
                        {node.name}
                    </span>
                </div>

                {/* Child Nodes (Rendered if folder is open) */}
                {isFolder && isOpen && (
                    // Indent children visually under the parent folder name
                    <ul className="pl-4 border-l border-slate-200 dark:border-slate-700 ml-[calc(0.25rem+0.875rem+0.25rem+0.375rem)]"> {/* Adjust margin to align border: pl-1 + chevron_pr + chevron_w + folder_mr */}
                        {node.children.map(child => (
                            <TreeNodeComponent key={child.id} node={child} onSelectFile={onSelectFile} depth={depth + 1} />
                        ))}
                        {/* Visual cue if folder is empty */}
                        {node.children.length === 0 && (
                            <li className="pl-1 py-1 text-xs text-slate-400 dark:text-slate-500 italic" style={{ paddingLeft: `${(depth + 1) * 1.25}rem` }}>Empty</li>
                        )}
                    </ul>
                )}
            </li>
        );
    }); // End of React.memo


    // --- Main File Tree Component ---
    interface FileTreeProps { files: Source[]; onSelectFile: (file: Source) => void; }

    const FileTree: React.FC<FileTreeProps> = ({ files, onSelectFile }) => {
      // Memoize the tree structure to avoid rebuilding on every render if files haven't changed
      const tree = useMemo(() => buildFileTree(files), [files]);

      // Handle loading or empty state
      if (!files || files.length === 0) {
        return <p className="px-3 py-2 text-sm text-center text-slate-500 dark:text-slate-400">No files in data source.</p>;
      }

      // Render the tree
      return (
        <nav aria-label="File explorer">
          <ul className="space-y-0.5"> {/* Tighter spacing */}
            {tree.map(node => (
              // Use the unique node.id as the key
              <TreeNodeComponent key={node.id} node={node} onSelectFile={onSelectFile} depth={0} />
            ))}
          </ul>
        </nav>
      );
    };

    export default FileTree;
    

