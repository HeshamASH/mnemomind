import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Source } from '../types';
// Import react-pdf components
import { Document, Page, pdfjs } from 'react-pdf';
// Import the TYPE for PDFDocumentProxy separately
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Import stylesheets for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css'; // Add this for text layer support
import ErrorBoundary from './ErrorBoundary';

// Access types globally if declared elsewhere, otherwise keep these declarations
declare var hljs: any;
declare var marked: any;

// Set up the worker for react-pdf (Ensure this path is correct for your build setup)
// Using a CDN might be simpler if local setup is tricky
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


interface FileViewerProps {
  file: Source;
  content: string; // Expect base64 string for PDF, plain text otherwise
  onClose: () => void;
}

// --- Icons (Keep existing CloseIcon, add new ones) ---

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const ChevronLeftIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
);

const ChevronRightIcon: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
       <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
     </svg>
);

const ZoomOutIcon: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
       <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
     </svg>
);

const ZoomInIcon: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
       <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
     </svg>
);


// --- Helper Function ---
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Failed to decode base64 string:", error);
    // Return an empty array or re-throw depending on how you want calling code to handle it
    throw new Error("Invalid Base64 data for PDF.");
  }
}


// --- Component ---

const FileViewer: React.FC<FileViewerProps> = ({ file, content, onClose }) => {
  const codeRef = useRef<HTMLElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null); // Ref for PDF container width

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null); // Store binary PDF data here

  const isMarkdown = file.fileName.toLowerCase().endsWith('.md');
  const isPdf = file.fileName.toLowerCase().endsWith('.pdf');

  // Constants for zoom limits
  const ZOOM_STEP = 0.2;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 3.0;

  // Effect for handling non-PDF content (Markdown, Code)
  useEffect(() => {
    // Only run if content is loaded and it's not a PDF being handled separately
    if (!content || content === 'Loading...' || isPdf) return;

    setPdfError(null); // Clear any previous PDF errors

    if (isMarkdown && markdownRef.current && typeof marked !== 'undefined') {
        try {
            const rawHtml = marked.parse(content, { breaks: true, gfm: true });
            // Basic sanitization to prevent script injection
            const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            markdownRef.current.innerHTML = sanitizedHtml;
            // Highlight code blocks within markdown
            markdownRef.current.querySelectorAll('pre code').forEach((block) => {
                if (typeof hljs !== 'undefined') {
                  hljs.highlightElement(block as HTMLElement);
                }
            });
        } catch (e) {
            console.error("Failed to parse or highlight Markdown:", e);
            // Fallback to displaying raw text if parsing/highlighting fails
            if(markdownRef.current) markdownRef.current.textContent = content;
        }
    } else if (codeRef.current && typeof hljs !== 'undefined') {
       // Handle code highlighting for other text files
       try {
            const extension = file.fileName.split('.').pop()?.toLowerCase() || 'plaintext';
            // Check if the language is supported, default to plaintext otherwise
            const language = hljs.getLanguage(extension) ? extension : 'plaintext';

            // Set the language class for highlight.js
            codeRef.current.className = `language-${language}`;
            // IMPORTANT: Set the text content *before* highlighting
            codeRef.current.textContent = content;
            // Let highlight.js apply syntax highlighting
            hljs.highlightElement(codeRef.current);
        } catch (e) {
            console.error("Failed to highlight code block:", e);
            // Fallback: If highlighting fails, ensure raw text is displayed without language class
            if (codeRef.current) {
                codeRef.current.className = '';
                codeRef.current.textContent = content;
            }
        }
    } else if (codeRef.current) {
        // Fallback for plain text display if hljs is not available or if it's not markdown/code
        codeRef.current.className = '';
        codeRef.current.textContent = content;
    }
  }, [content, isMarkdown, isPdf, file.fileName]); // Rerun if content, type, or filename changes


   // Effect for handling PDF data decoding when content or isPdf changes
  useEffect(() => {
      if (isPdf && content && content !== 'Loading...') {
          console.log("Attempting to decode Base64 for PDF...");
          setPdfLoading(true);
          setPdfError(null); // Reset error state
          setNumPages(null); // Reset page count
          setPdfData(null); // Clear previous data
          try {
              // Decode the base64 string provided in the 'content' prop
              const binaryData = base64ToUint8Array(content);
              setPdfData(binaryData); // Store the Uint8Array for <Document>
              setPageNumber(1); // Reset to first page for new PDF
              console.log("Base64 decoded successfully for PDF.");
          } catch (error) {
              console.error("PDF Base64 Decode Error in useEffect:", error);
              // Set specific error message based on the caught error
              const message = error instanceof Error ? error.message : "Failed to decode PDF data. Ensure content is valid Base64.";
              setPdfError(message);
              // Ensure pdfData is nullified on error
              setPdfData(null);
              setNumPages(null);
              setPdfLoading(false); // Stop loading indicator on error
          }
           // Loading state will be set to false in onDocumentLoadSuccess/Error
      } else if (!isPdf) {
          // Explicitly clear PDF state if the file shown is not a PDF
          setPdfData(null);
          setNumPages(null);
          setPdfError(null);
          setPdfLoading(false); // Ensure loading is false if not PDF
      } else if (isPdf && content === 'Loading...') {
          // Handle initial loading state for PDF
          setPdfLoading(true);
          setPdfError(null);
          setNumPages(null);
          setPdfData(null);
      }
  }, [content, isPdf]); // Rerun this effect if content or isPdf changes


  // --- PDF Callbacks ---
  const onDocumentLoadSuccess = useCallback(({ numPages: nextNumPages }: PDFDocumentProxy) => {
    console.log(`PDF loaded successfully with ${nextNumPages} pages.`);
    setNumPages(nextNumPages);
    setPdfLoading(false); // Stop loading indicator
    setPdfError(null); // Clear any previous error on success
  }, []);

   const onDocumentLoadError = useCallback((error: Error) => {
    console.error('react-pdf failed to load PDF document:', error);
    // Use a more specific error message from react-pdf if available
    setPdfError(`Failed to load PDF: ${error.message}. Is the file corrupted or the format unsupported?`);
    setNumPages(null); // Reset pages
    setPdfLoading(false); // Stop loading indicator
    setPdfData(null); // Clear potentially bad data
  }, []);

  // --- PDF Navigation & Zoom Handlers ---
  const goToPrevPage = useCallback(() => {
    setPageNumber(prevPageNumber => Math.max(prevPageNumber - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prevPageNumber => Math.min(prevPageNumber + 1, numPages || 1));
  }, [numPages]);

   const zoomIn = useCallback(() => {
     setPdfScale(prevScale => Math.min(prevScale + ZOOM_STEP, MAX_ZOOM));
   }, []);

   const zoomOut = useCallback(() => {
     setPdfScale(prevScale => Math.max(prevScale - ZOOM_STEP, MIN_ZOOM));
   }, []);


  // --- Render ---
  return (
    // Modal Backdrop
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
      onClick={onClose} // Close modal on backdrop click
    >
      {/* Modal Container */}
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" // Added overflow hidden
        onClick={e => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        {/* Header */}
        <header className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          {/* File Info */}
          <div className="overflow-hidden mr-4 flex-1 min-w-0"> {/* Allow shrinking */}
            <h3 className="font-bold text-lg text-cyan-600 dark:text-cyan-400 truncate" title={file.fileName}>{file.fileName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate" title={file.path || '/'}>{file.path || '/'}</p>
          </div>
          {/* Controls */}
          <div className="flex items-center flex-shrink-0 gap-1 sm:gap-2"> {/* Responsive gap */}
             {/* PDF Specific Controls */}
             {isPdf && numPages && !pdfLoading && !pdfError && (
                 <>
                    {/* Zoom Controls */}
                    <button onClick={zoomOut} disabled={pdfScale <= MIN_ZOOM} className="p-1.5 sm:p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition" aria-label="Zoom out">
                        <ZoomOutIcon />
                    </button>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 w-10 sm:w-12 text-center tabular-nums">{Math.round(pdfScale * 100)}%</span>
                    <button onClick={zoomIn} disabled={pdfScale >= MAX_ZOOM} className="p-1.5 sm:p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition" aria-label="Zoom in">
                        <ZoomInIcon />
                    </button>

                    {/* Separator */}
                    <span className="mx-1 sm:mx-2 text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>

                    {/* Page Navigation */}
                    <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="p-1.5 sm:p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition" aria-label="Previous page">
                        <ChevronLeftIcon />
                    </button>
                    <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 tabular-nums">
                        {pageNumber} / {numPages}
                    </div>
                    <button onClick={goToNextPage} disabled={pageNumber >= numPages} className="p-1.5 sm:p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition" aria-label="Next page">
                        <ChevronRightIcon />
                    </button>
                 </>
             )}
             {/* Close Button */}
            <button onClick={onClose} className="ml-2 sm:ml-4 p-1.5 sm:p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close file viewer">
              <CloseIcon />
            </button>
          </div>
        </header>

         {/* Main Content Area (Scrollable) */}
        <main ref={pdfContainerRef} className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-800/50 relative"> {/* Slightly lighter bg */}
          <ErrorBoundary>
            {/* Loading State */}
            {(content === 'Loading...' || (isPdf && pdfLoading)) && (
               <div className="flex justify-center items-center h-full pt-10">
                  <svg className="animate-spin h-8 w-8 text-cyan-600 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-slate-500 dark:text-slate-400">Loading document...</span>
               </div>
            )}

            {/* Error State */}
            {pdfError && isPdf && (
               <div className="text-center p-6 bg-red-100 dark:bg-red-900/30 rounded-md border border-red-300 dark:border-red-700">
                 <p className="text-red-700 dark:text-red-300 font-semibold mb-1">Error Loading PDF</p>
                 <p className="text-red-600 dark:text-red-400 text-sm">{pdfError}</p>
               </div>
            )}

            {/* PDF View */}
            {isPdf && pdfData && !pdfError && !pdfLoading && (
              <div className="flex justify-center items-start pt-2"> {/* Center PDF page */}
                <Document
                  file={{ data: pdfData }} // Pass the Uint8Array data
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading="" // Use our custom spinner above
                  error="" // Use our custom error display above
                  className="pdf-document-container" // Add class for potential styling
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={pdfScale}
                    renderTextLayer={true} // Enable text selection/copy
                    renderAnnotationLayer={true} // Show links, etc.
                    className="pdf-page-container shadow-md" // Add class for styling page
                   />
                </Document>
              </div>
            )}

            {/* Markdown View */}
            {!isPdf && isMarkdown && content && content !== 'Loading...' && (
               <div
                ref={markdownRef}
                className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-200 dark:prose-pre:bg-slate-950 prose-pre:p-4 prose-code:text-cyan-600 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono"
               />
            )}

            {/* Code/Text View */}
            {!isPdf && !isMarkdown && content && content !== 'Loading...' && (
              <pre className="bg-white dark:bg-slate-900 rounded-md p-4 overflow-x-auto border border-slate-200 dark:border-slate-700">
                <code ref={codeRef} className="text-sm font-mono whitespace-pre-wrap">
                  {/* Content set via useEffect */}
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

