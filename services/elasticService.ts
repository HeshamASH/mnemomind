import { ElasticResult, Source } from '../types';

// Use a relative path assuming the frontend and backend are served from the same origin in production,
// or rely on the Vite proxy in development.
const API_BASE_URL = '/api';

// Improved error handling function
const handleApiError = async (response: Response, contextMessage: string): Promise<Error> => {
    let errorDetails = `Status: ${response.status} ${response.statusText}`;
    try {
        const errorBody = await response.json();
        // Try to get a specific detail message from the backend error structure
        errorDetails += ` - Detail: ${errorBody?.detail || JSON.stringify(errorBody)}`;
    } catch (e) {
        // If parsing JSON fails, read the response as text
        try {
            const textBody = await response.text();
            errorDetails += ` - Response Body: ${textBody}`;
        } catch (textError) {
             errorDetails += ` - Failed to read response body.`;
        }
    }
    const errorMessage = `${contextMessage}. ${errorDetails}`;
    console.error(errorMessage); // Log detailed error
    return new Error(contextMessage); // Return a simpler error for the UI
};


export const searchCloudDocuments = async (query: string): Promise<ElasticResult[]> => {
    console.log(`[API] Searching cloud for: "${query}"`);
    const endpoint = `${API_BASE_URL}/search`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any other necessary headers, e.g., authentication if needed later
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw await handleApiError(response, 'API search request failed');
        }

        const data = await response.json();
        // Basic validation of the expected response structure
        if (!Array.isArray(data)) {
            console.error("API search response is not an array:", data);
            throw new Error("Received invalid search results format from API.");
        }
        // Add more specific validation if needed (e.g., check for source.id, etc.)
        return data as ElasticResult[];

    } catch (error) {
        console.error("Error searching cloud documents:", error);
        // Re-throw the error or throw a new user-friendly one
        throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getCloudFileContent = async (source: Source): Promise<string> => {
    // Log ID for easier debugging
    console.log(`[API] Fetching cloud content for: "${source.fileName}" (ID: ${source.id})`);
    const endpoint = `${API_BASE_URL}/files/${source.id}`;

    try {
        const response = await fetch(endpoint);

        if (!response.ok) {
             // Handle 404 specifically
            if (response.status === 404) {
                 console.error(`File not found in cloud storage (404): ID ${source.id}, Name ${source.fileName}`);
                 return `Error: File "${source.fileName}" not found.`;
            }
            throw await handleApiError(response, `Failed to fetch content for ${source.fileName}`);
        }

        const data = await response.json();

        // Check if content exists and is a string
        if (typeof data.content !== 'string') {
             console.error(`Content field missing or not a string in response for file ID ${source.id}`);
             return "Error: Content field missing or invalid in API response.";
        }

        // The FileViewer now expects base64 for PDFs, plain text otherwise.
        // The backend's 'isBase64' flag isn't strictly needed here anymore,
        // as FileViewer checks the file extension.
        return data.content;

    } catch (error) {
        // Log the error before returning a user-friendly message
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching cloud file content for ${source.fileName} (ID: ${source.id}):`, errorMessage);
        // Return an error string for the viewer to display
        return `Error: Could not load content for "${source.fileName}".`;
    }
};


export const getAllCloudFiles = async (): Promise<Source[]> => {
    console.log(`[API] Fetching all cloud files list`);
    const endpoint = `${API_BASE_URL}/files`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw await handleApiError(response, 'Failed to fetch file list from API');
        }
        const data = await response.json();
        // Basic validation
        if (!Array.isArray(data)) {
            console.error("API file list response is not an array:", data);
            throw new Error("Received invalid file list format from API.");
        }
        // Add more validation if needed (check items have id, fileName, path)
        return data as Source[];
    } catch (error) {
        console.error("Error fetching all cloud files:", error);
        throw new Error(`Failed to retrieve file list: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// --- Preloaded (Client-Side) Data Handling ---
// (These functions run entirely in the browser and don't call the /api backend)

/**
 * Creates a dataset (simulating Elastic results) from an array of File objects.
 * Reads file content as text. For PDF/Images, content might be less useful here
 * unless specifically processed for text extraction client-side (more complex).
 */
export const createDatasetFromSources = async (files: File[]): Promise<ElasticResult[]> => {
    console.log('[Client-side] Creating dataset from', files.length, 'files.');
    const dataset: ElasticResult[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('[Client-side] Processing file:', file.name);
        try {
            let content = '';
            // Basic text extraction for common types. Real PDF/DOCX extraction is complex client-side.
            if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/markdown') {
                content = await file.text();
            } else if (file.type === 'application/pdf') {
                 content = `[PDF Content for ${file.name} - Full viewing requires backend processing or dedicated library]`; // Placeholder for client-side
            }
             else {
                 content = `[Binary or unsupported file type: ${file.type}]`; // Placeholder
            }

            console.log('[Client-side] File content length (approx):', content.length);

/**
 * Updates the content of a file in the preloaded dataset.
 * 
 * @param source The file to update, identified by its ID.
 * @param newContent The new content for the file.
 * @param dataset The preloaded dataset to update.
 * @returns {success: boolean, newDataset: ElasticResult[]} An object containing a success flag and the updated dataset.
 */
            // Use webkitRelativePath if available (for folder uploads), otherwise just filename
            const path = (file as any).webkitRelativePath || file.name;
            // Extract just the directory path part for consistency with backend source format
            const pathParts = path.split('/');
            const fileName = pathParts.pop() || file.name; // Get filename
            const directoryPath = pathParts.join('/'); // Get directory path

            dataset.push({
                source: {
                    id: `local-${file.name}-${file.lastModified}-${i}`, // More unique ID
                    fileName: fileName,
                    path: directoryPath, // Store directory path separately
                },
                contentSnippet: content, // Store extracted text or placeholder
                score: 1.0, // Default score for local files
            });
        } catch (readError) {
             console.error(`[Client-side] Error reading file ${file.name}:`, readError);
             // Optionally add an entry indicating the error
             dataset.push({
                source: {
                    id: `error-${file.name}-${file.lastModified}-${i}`,
                    fileName: file.name,
                    path: (file as any).webkitRelativePath?.split('/').slice(0, -1).join('/') || '',
                },
                contentSnippet: `[Error reading file content: ${readError instanceof Error ? readError.message : 'Unknown error'}]`,
                score: 0,
             });
        }
    }
    console.log('[Client-side] Dataset created with', dataset.length, 'entries.');
    return dataset;
};

/**
 * Simple client-side text search within the preloaded dataset.
 * Scores based on rudimentary keyword matching (case-insensitive count).
 */
export const searchPreloadedDocuments = (query: string, dataset: ElasticResult[]): ElasticResult[] => {
    if (!query) return []; // Return empty if query is empty

    console.log(`[Client-side] Searching for: "${query}" in preloaded data (${dataset.length} items).`);
    const lowerCaseQuery = query.toLowerCase();

    // Escape special regex characters in the query for safe use in RegExp
    const escapedQuery = lowerCaseQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const results = dataset
        .map(doc => {
            let score = 0;
            if (doc.contentSnippet) {
                try {
                    // Count occurrences of the query string case-insensitively
                    const matches = doc.contentSnippet.toLowerCase().match(new RegExp(escapedQuery, 'g'));
                    score = matches ? matches.length : 0;

                    // Boost score if filename matches
                    if (doc.source.fileName.toLowerCase().includes(lowerCaseQuery)) {
                        score += 5; // Add arbitrary boost for filename match
                    }
                    // Boost score if path matches
                     if (doc.source.path.toLowerCase().includes(lowerCaseQuery)) {
                        score += 2; // Add smaller boost for path match
                    }

                } catch(e) {
                     console.warn(`[Client-side] Regex error during search for query "${escapedQuery}" in doc ${doc.source.id}:`, e);
                     score = 0; // Assign 0 score if regex fails
                }
            }
            return { ...doc, score };
        })
        .filter(doc => doc.score > 0) // Only include documents with a score > 0
        .sort((a, b) => b.score - a.score); // Sort by score descending

     console.log(`[Client-side] Found ${results.length} results for "${query}".`);
    return results;
};

/**
 * Gets a unique list of Source objects from the preloaded dataset.
 */
export const getAllPreloadedFiles = (dataset: ElasticResult[]): Source[] => {
    // Use a Map to ensure uniqueness based on source ID
    const uniqueSources = new Map<string, Source>();
    dataset.forEach(doc => {
        if (doc.source && doc.source.id) { // Ensure source and id exist
            uniqueSources.set(doc.source.id, doc.source);
        }
    });
    const sources = Array.from(uniqueSources.values());
     console.log(`[Client-side] Retrieved ${sources.length} unique preloaded file sources.`);
    return sources;
};

/**
 * Retrieves the full content snippet stored for a given Source ID from the dataset.
 */
export const getPreloadedFileContent = (source: Source, dataset: ElasticResult[]): string | null => {
    if (!source || !source.id) return null; // Guard clause

    const doc = dataset.find(d => d.source.id === source.id);
    if (doc) {
        console.log(`[Client-side] Found content for preloaded file: ${source.fileName}`);
        return doc.contentSnippet.trim(); // Return the stored content
    } else {
         console.warn(`[Client-side] Content not found for preloaded file ID: ${source.id}`);
        return null;
    }
};

/**
 * Updates the content snippet for a specific Source ID within the dataset.
 * Returns an object indicating success and the potentially modified dataset.
 */
export const updateFileContent = (
    source: Source,
    newContent: string,
    dataset: ElasticResult[]
): { success: boolean; newDataset: ElasticResult[] } => {

    if (!source || !source.id) {
         console.error("[Client-side] Cannot update content: Invalid source object provided.");
         return { success: false, newDataset: dataset };
    }

    let found = false;
    const newDataset = dataset.map(doc => {
        if (doc.source.id === source.id) {
            found = true;
            console.log(`[Client-side] Updating content for preloaded file: "${source.fileName}" (ID: ${source.id})`);
            return { ...doc, contentSnippet: newContent }; // Update the content
        }
        return doc; // Return unmodified doc if ID doesn't match
    });

    if (!found) {
        console.error(`[Client-side] Could not find preloaded file to update with ID: ${source.id}`);
    }

    return { success: found, newDataset };
};

