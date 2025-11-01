import React, { useRef, useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

declare var hljs: any;
declare var marked: any;

interface MarkdownRendererProps {
  text: string;
  onExportToSheets: (tableData: (string | null)[][]) => void;
  messageIndex: number;
}

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 inline-block mr-1 align-text-bottom">
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);

const tableToMarkdown = (tableEl: HTMLTableElement): string => {
    let markdown = '';
    const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.textContent?.trim() || '');
    markdown += `| ${headers.join(' | ')} |\n`;
    markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;

    tableEl.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
        markdown += `| ${cells.join(' | ')} |\n`;
    });

    return markdown;
};

interface CopyToSheetsButtonProps {
  tableData: (string | null)[][];
  onExportToSheets: (tableData: (string | null)[][]) => void;
}

const CopyToSheetsButton: React.FC<CopyToSheetsButtonProps> = ({ tableData, onExportToSheets }) => {
    const [exported, setExported] = useState(false);

    const handleExport = () => {
        onExportToSheets(tableData);
        setExported(true);
        setTimeout(() => setExported(false), 2000);
    };

    return (
        <button
            onClick={handleExport}
            className="absolute top-2 right-2 p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            title={exported ? 'Exported!' : 'Export to Google Sheets'}
        >
            <CopyIcon />
        </button>
    );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ text, onExportToSheets, messageIndex }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const roots: Root[] = [];
        const container = contentRef.current;

        if (container && typeof marked !== 'undefined') {
            // 1. Parse and sanitize the text
            const rawHtml = marked.parse(text, { breaks: true, gfm: true });
            const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            container.innerHTML = sanitizedHtml;

            // 2. Post-process the generated HTML
            // Enhance file mentions: `file:path/to/file.ext` -> styled span
            container.innerHTML = container.innerHTML.replace(
                /`file:([^`]+)`/g,
                `<span class="inline-flex items-center font-mono text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/50 px-1.5 py-0.5 rounded-md"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 inline-block mr-1 align-text-bottom"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" /></svg>$1</span>`
            );

            // Enhance source references: [1], [2] -> links
            container.innerHTML = container.innerHTML.replace(
                /\[(\d+)\]/g,
                `<a href="#source-${messageIndex}-$1" onclick="event.preventDefault(); document.getElementById('source-${messageIndex}-$1')?.scrollIntoView({ behavior: 'smooth', block: 'center' });" class="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">[$1]</a>`
            );

            container.querySelectorAll('a[href^="#source-"]').forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    const sourceId = (e.currentTarget as HTMLAnchorElement).hash.substring(1);
                    const event = new CustomEvent('sourceLinkClick', { detail: { sourceId, messageIndex } });
                    window.dispatchEvent(event);
                });
            });

            // Highlight code blocks and add copy button
            container.querySelectorAll('pre').forEach((preBlock) => {
                const codeBlock = preBlock.querySelector('code');
                if (codeBlock && typeof hljs !== 'undefined') {
                    hljs.highlightElement(codeBlock as HTMLElement);

                    const wrapper = document.createElement('div');
                    wrapper.className = 'relative group';

                    const button = document.createElement('button');
                    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><span>Copy</span>`;
                    button.className = 'absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity';

                    let timeoutId: number;
                    button.addEventListener('click', () => {
                        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                            button.innerHTML = `<span>Copied!</span>`;
                            clearTimeout(timeoutId);
                            timeoutId = window.setTimeout(() => {
                                button.innerHTML = `<svg xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><span>Copy</span>`;
                            }, 2000);
                        });
                    });

                    preBlock.parentNode?.insertBefore(wrapper, preBlock);
                    wrapper.appendChild(preBlock);
                    wrapper.appendChild(button);
                }
            });

            // Inject React component for tables and keep track of them for cleanup
            container.querySelectorAll('table').forEach(tableEl => {
                tableEl.classList.add('min-w-full', 'divide-y', 'divide-slate-200', 'dark:divide-slate-700', 'table-fixed');
                tableEl.querySelector('thead')?.classList.add('bg-slate-50', 'dark:bg-slate-800');
                tableEl.querySelectorAll('th').forEach(th => {
                    th.classList.add('px-6', 'py-3', 'text-left', 'text-xs', 'font-medium', 'text-slate-500', 'uppercase', 'tracking-wider');
                });
                tableEl.querySelectorAll('tbody tr').forEach(tr => {
                    tr.classList.add('odd:bg-white', 'odd:dark:bg-slate-900', 'even:bg-slate-50', 'even:dark:bg-slate-800');
                });
                tableEl.querySelectorAll('td').forEach(td => {
                    td.classList.add('px-6', 'py-4', 'whitespace-normal', 'break-words', 'text-sm', 'text-slate-900', 'dark:text-slate-200');
                });

                const wrapper = document.createElement('div');
                wrapper.className = 'mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden';

                tableEl.parentNode?.insertBefore(wrapper, tableEl);
                wrapper.appendChild(tableEl);

                const footer = document.createElement('div');
                footer.className = 'flex items-center justify-end gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg border-t border-slate-200 dark:border-slate-700';

                // Export to Sheets button
                const exportButtonContainer = document.createElement('div');
                exportButtonContainer.className = 'relative';
                const exportButton = document.createElement('button');
                exportButton.innerHTML = `<span>Export to Google Sheets</span>`;
                exportButton.className = 'px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 rounded-md cursor-not-allowed';
                exportButton.disabled = true;
                const comingSoonText = document.createElement('span');
                comingSoonText.innerText = 'coming soon';
                comingSoonText.className = 'absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 dark:text-slate-500';
                exportButtonContainer.appendChild(exportButton);
                exportButtonContainer.appendChild(comingSoonText);

                // Copy table button
                const copyButton = document.createElement('button');
                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><span>Copy table</span>`;
                copyButton.className = 'flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600';

                let timeoutId: number;
                copyButton.addEventListener('click', () => {
                    const markdownTable = tableToMarkdown(tableEl);
                    navigator.clipboard.writeText(markdownTable).then(() => {
                        copyButton.innerHTML = `<span>Copied!</span>`;
                        clearTimeout(timeoutId);
                        timeoutId = window.setTimeout(() => {
                           copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><span>Copy table</span>`;
                        }, 2000);
                    });
                });

                footer.appendChild(exportButtonContainer);
                footer.appendChild(copyButton);
                wrapper.appendChild(footer);
            });
        }

        // Return a cleanup function to be run when the effect is re-executed or the component unmounts
        return () => {
            // First, unmount all the React components to prevent memory leaks
            roots.forEach(root => root.unmount());

            // Then, as a failsafe, completely clear the container's DOM. This robustly
            // prevents any lingering DOM references from causing serialization errors.
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [text, onExportToSheets, messageIndex]);

    return <div ref={contentRef} className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-200 dark:prose-pre:bg-slate-950 prose-pre:p-4 prose-code:text-cyan-600 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-table:w-full prose-table:text-sm prose-thead:bg-slate-100 dark:prose-thead:bg-slate-800 prose-th:p-3 prose-th:font-semibold prose-th:text-left prose-th:text-black dark:prose-th:text-white prose-td:p-3 prose-td:border-b prose-td:border-slate-200 dark:prose-td:border-slate-700 prose-td:text-black dark:prose-td:text-white" />;
};
export default MarkdownRenderer;