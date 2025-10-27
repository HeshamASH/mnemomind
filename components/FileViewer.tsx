import React, { useRef, useEffect } from 'react';
import { Source } from '../types';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import ErrorBoundary from './ErrorBoundary';

declare var hljs: any;
declare var marked: any;

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface FileViewerProps {
  file: Source;
  content: string;
  onClose: () => void;
}

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FileViewer: React.FC<FileViewerProps> = ({ file, content, onClose }) => {
  const codeRef = useRef<HTMLElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  
  const isMarkdown = file.file_name.toLowerCase().endsWith('.md');
  const isPdf = file.file_name.toLowerCase().endsWith('.pdf');
  const isTxt = file.file_name.toLowerCase().endsWith('.txt');
  const isPreloadedPdf = isPdf && content.startsWith('data:application/pdf;base64,');

  useEffect(() => {
    if (content === 'Loading...') return;

    if (isMarkdown && markdownRef.current && typeof marked !== 'undefined') {
        const rawHtml = marked.parse(content, { breaks: true, gfm: true });
        // Basic sanitization to prevent script injection
        const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        markdownRef.current.innerHTML = sanitizedHtml;
        markdownRef.current.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') {
              hljs.highlightElement(block as HTMLElement);
            }
        });
    } else if (!isMarkdown && !isPdf && !isTxt && codeRef.current && typeof hljs !== 'undefined') {
       // For non-markdown, non-pdf, non-txt, attempt to highlight, but gracefully fallback to plaintext.
       try {
            const extension = file.file_name.split('.').pop() || 'plaintext';
            // Check if the language is supported by highlight.js, otherwise default to plaintext
            const language = hljs.getLanguage(extension) ? extension : 'plaintext';
            
            // Set the language class for highlight.js
            codeRef.current.className = `language-${language}`;
            // Let highlight.js do its thing
            hljs.highlightElement(codeRef.current);
        } catch (e) {
            console.error("Failed to highlight code block:", e);
            // If highlighting fails for any reason, ensure the raw text is displayed
            // by removing any language classes.
            if (codeRef.current) {
                codeRef.current.className = '';
            }
        }
    }
  }, [content, isMarkdown, isPdf, isTxt, file.file_name]);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{file.file_name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{file.path}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close file viewer">
            <CloseIcon />
          </button>
        </header>
        <main className="p-4 overflow-auto">
          <ErrorBoundary>
            {content === 'Loading...' ? (
               <div className="flex justify-center items-center h-full">
                  <span className="w-3 h-3 bg-slate-400 rounded-full inline-block animate-pulse"></span>
               </div>
            ) : isPdf ? (
              <Document file={isPreloadedPdf ? content : `data:application/pdf;base64,${btoa(content)}`} onLoadError={console.error}>
                <Page pageNumber={1} />
              </Document>
            ) : isMarkdown ? (
               <div 
                ref={markdownRef}
                className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-200 dark:prose-pre:bg-slate-950 prose-pre:p-4 prose-code:text-cyan-600 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono"
               />
            ) : isTxt ? (
              <div className="text-base font-sans text-slate-800 dark:text-slate-200 whitespace-pre-wrap p-4">
                {content}
              </div>
            ) : (
              <pre className="bg-slate-50 dark:bg-slate-950 rounded-md p-4 overflow-x-auto">
                <code ref={codeRef} className="text-sm font-mono whitespace-pre-wrap">
                  {content}
                </code>
              </pre>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default FileViewer;
