import React, { useRef, useEffect, useState, useMemo } from 'react'; // Added useMemo
import { createRoot, Root } from 'react-dom/client';
// Import ElasticResult
import { ElasticResult } from '../types';


declare var hljs: any;
declare var marked: any;

interface MarkdownRendererProps {
  text: string;
  onExportToSheets: (tableData: (string | null)[][]) => void;
  // Handler for citation clicks (receives 0-based index)
  onCitationClick?: (index: number) => void;
  // Array of sources corresponding to citations
  elasticSources?: ElasticResult[];
}


// Copy Icon (for table export button)
const CopyIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      {/* Icon path remains the same */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);
// Check Icon (for table export confirmation)
const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);


// --- CopyToSheetsButton Component (with confirmation state) ---
interface CopyToSheetsButtonProps {
  tableData: (string | null)[][];
  onExportToSheets: (tableData: (string | null)[][]) => void;
}
const CopyToSheetsButton: React.FC<CopyToSheetsButtonProps> = ({ tableData, onExportToSheets }) => {
    const [exported, setExported] = useState(false);
    const timeoutRef = useRef<number | null>(null); // Ref to store timeout ID

    const handleExport = () => {
        // Clear previous timeout if exists
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        onExportToSheets(tableData);
        setExported(true);
        // Set timeout to reset state after 2 seconds
        timeoutRef.current = window.setTimeout(() => {
            setExported(false);
            timeoutRef.current = null; // Clear ref after execution
        }, 2000);
    };

     // Cleanup timeout on component unmount
     useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);


    return (
        <button
            onClick={handleExport}
            // Add fixed width to prevent layout shift
            className="absolute top-2 right-2 p-1.5 w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-150"
            title={exported ? 'Exported!' : 'Export to Google Sheets'}
            disabled={exported} // Disable briefly after click
        >
            {exported ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
};

// --- Main Markdown Renderer Component ---
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    text,
    onExportToSheets,
    onCitationClick, // Use new prop
    elasticSources   // Use new prop
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    // Memoize listeners map to prevent recreation on every render unless deps change
    const citationListeners = useMemo(() => new Map<HTMLElement, (e: MouseEvent) => void>(), []);
    const roots = useRef<Root[]>([]); // Use ref for React roots to manage cleanup

    useEffect(() => {
        const container = contentRef.current;

        // Clear previous listeners before adding new ones
        citationListeners.forEach((listener, element) => {
            element.removeEventListener('click', listener);
        });
        citationListeners.clear();
        // Unmount previous React roots
        roots.current.forEach(root => root.unmount());
        roots.current = [];

        if (container && typeof marked !== 'undefined') {
            try {
                // 1. Parse and sanitize Markdown
                const rawHtml = marked.parse(text, { breaks: true, gfm: true, async: false }); // Ensure synchronous parsing if possible
                const sanitizedHtml = String(rawHtml).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                container.innerHTML = sanitizedHtml;

                // 2. Post-process HTML for enhancements

                // Enhance file mentions: `file:path/to/file.ext` -> styled span
                // This approach is okay but could be fragile. Consider a more robust parser if needed.
                container.innerHTML = container.innerHTML.replace(
                     /`file:([^`]+)`/g, // Matches `file:anything_not_backtick`
                     (_, fileName) => // Use function for safer replacement
                         `<span class="inline-flex items-center font-mono text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/50 px-1.5 py-0.5 rounded-md whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 inline-block mr-1 align-text-bottom flex-shrink-0"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" /></svg><span class="truncate">${fileName}</span></span>`
                 );


                // Highlight code blocks using highlight.js
                container.querySelectorAll('pre code').forEach((block) => {
                    if (typeof hljs !== 'undefined') {
                        try {
                             hljs.highlightElement(block as HTMLElement);
                             // Add copy button to code blocks
                             const pre = block.parentElement;
                             if (pre) {
                                 pre.classList.add('relative'); // Needed for absolute positioning of button
                                 const button = document.createElement('button');
                                 button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375-3.75-3.75m3.75 3.75a1.125 1.125 0 0 1-1.125 1.125H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.75m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>';
                                 button.className = "absolute top-2 right-2 p-1 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-400 dark:hover:bg-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity";
                                 button.title = "Copy code";
                                 button.onclick = () => {
                                     navigator.clipboard.writeText(block.textContent || '')
                                         .then(() => {
                                             button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>'; // Checkmark
                                             setTimeout(() => {
                                                  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375-3.75-3.75m3.75 3.75a1.125 1.125 0 0 1-1.125 1.125H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.75m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>'; // Restore icon
                                             }, 1500);
                                         })
                                         .catch(err => console.error('Failed to copy code:', err));
                                 };
                                 pre.appendChild(button);
                             }
                        } catch(e) { console.error("Highlight.js error:", e); }
                    }
                });

                // Process Tables and Inject React Component for Export Button
                container.querySelectorAll('table').forEach((tableEl, tableIndex) => {
                    const wrapper = document.createElement('div');
                    // Add relative positioning and overflow for sticky header/button
                    wrapper.className = 'relative mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto shadow-sm';

                    const header = document.createElement('div');
                    // Style header and make it sticky within the wrapper
                    header.className = 'flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-t-lg border-b border-slate-200 dark:border-slate-700 sticky left-0 z-10';
                    const title = document.createElement('h4');
                    title.className = 'font-semibold text-sm text-slate-700 dark:text-slate-300';
                    title.textContent = `Table ${tableIndex + 1}`; // Add index to title
                    header.appendChild(title);

                    const buttonContainer = document.createElement('div'); // Container for React button
                    header.appendChild(buttonContainer);

                    wrapper.appendChild(header);
                    // Replace the original table with the wrapper containing header and table
                    tableEl.parentNode?.replaceChild(wrapper, tableEl);
                    // Add styling to the table itself
                    tableEl.classList.add('min-w-full', 'divide-y', 'divide-slate-200', 'dark:divide-slate-700');
                    wrapper.appendChild(tableEl); // Append the original table into the wrapper

                    // Extract table data for the export button
                    const tableData = Array.from(tableEl.querySelectorAll('tr')).map((row: Element) =>
                        Array.from(row.querySelectorAll('th, td')).map((cell: Element) => cell.textContent)
                    );

                    // Create a React root and render the export button
                    const root = createRoot(buttonContainer);
                    root.render(<CopyToSheetsButton tableData={tableData} onExportToSheets={onExportToSheets} />);
                    roots.current.push(root); // Store root for cleanup
                });

                // --- Make citations [n] clickable ---
                if (onCitationClick && elasticSources && elasticSources.length > 0) {
                     // Use TreeWalker to find all text nodes
                     const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                     let node;
                     const nodesToReplace: { original: Text, fragment: DocumentFragment }[] = [];

                     while(node = walker.nextNode()) {
                         const textNode = node as Text;
                         const textContent = textNode.nodeValue || '';
                         // Only process nodes containing potential citations
                         if (/\[\d+\]/.test(textContent)) {
                             const fragment = document.createDocumentFragment();
                             let lastIndex = 0;
                             let replaced = false;

                             // Use regex exec to find all matches iteratively
                             const citationRegex = /\[(\d+)\]/g;
                             let match;
                             while ((match = citationRegex.exec(textContent)) !== null) {
                                 const fullMatch = match[0];
                                 const numStr = match[1];
                                 const offset = match.index;
                                 const citationNum = parseInt(numStr, 10);
                                 const index = citationNum - 1; // 0-based index

                                 // Add preceding text
                                 if (offset > lastIndex) {
                                     fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, offset)));
                                 }

                                 // Check if citation number is valid (must be 1 or greater)
                                 if (citationNum > 0 && index < elasticSources.length) {
                                     const button = document.createElement('button');
                                     button.textContent = fullMatch;
                                     // Improved styling for visibility and interaction
                                     button.className = "citation-link font-bold text-cyan-600 dark:text-cyan-400 hover:underline px-0.5 mx-px bg-cyan-100 dark:bg-cyan-900/50 rounded-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 dark:focus:ring-offset-slate-800 transition-colors";
                                     button.title = `View source chunk ${citationNum}: ${elasticSources[index].source.fileName}`;

                                     // Define listener function
                                     const listener = (e: MouseEvent) => {
                                         e.preventDefault();
                                         console.log(`Citation ${citationNum} clicked (index ${index})`); // Debug log
                                         onCitationClick(index);
                                     };
                                     button.addEventListener('click', listener);
                                     citationListeners.set(button, listener); // Store for cleanup
                                     fragment.appendChild(button);
                                     replaced = true; // Mark that we made a replacement
                                 } else {
                                     // Invalid citation number, render as plain text
                                     fragment.appendChild(document.createTextNode(fullMatch));
                                     console.warn(`Invalid citation number encountered: ${citationNum}`);
                                 }
                                 lastIndex = offset + fullMatch.length;
                             }

                             // Add any remaining text after the last citation
                             if (lastIndex < textContent.length) {
                                 fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));
                             }

                             // If we actually created buttons, schedule the replacement
                             if (replaced && textNode.parentNode) {
                                 nodesToReplace.push({ original: textNode, fragment });
                             }
                         }
                     }
                      // Perform DOM replacements after iterating
                      nodesToReplace.forEach(({ original, fragment }) => {
                        original.parentNode!.replaceChild(fragment, original);
                     });
                }

            } catch (parseError) {
                 console.error("Error parsing or processing Markdown:", parseError);
                 // Fallback: Display raw text if parsing/processing fails
                 container.textContent = text;
            }
        }

        // --- Cleanup Function ---
        return () => {
            // Remove citation listeners
            citationListeners.forEach((listener, element) => {
                element.removeEventListener('click', listener);
            });
            citationListeners.clear();
            // Unmount React roots
            roots.current.forEach(root => root.unmount());
            roots.current = [];
            // Optional: Clear container content
            // if (container) {
            //     container.innerHTML = '';
            // }
        };
    // Re-run effect if text, handlers, or sources array length changes
    }, [text, onExportToSheets, onCitationClick, elasticSources, citationListeners]);


    // Refined Prose styles for better spacing, code blocks, tables, etc.
    return <div ref={contentRef} className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:my-2 prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900 prose-pre:p-0 prose-pre:rounded-md prose-pre:border dark:prose-pre:border-slate-700 prose-pre:shadow-sm prose-code:text-cyan-700 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-table:text-sm prose-thead:bg-slate-100 dark:prose-thead:bg-slate-800 prose-th:px-3 prose-th:py-2 prose-th:font-semibold prose-th:text-left prose-th:text-slate-900 dark:prose-th:text-slate-100 prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-slate-700 prose-td:text-slate-800 dark:prose-td:text-slate-200" />;
};
export default MarkdownRenderer;

