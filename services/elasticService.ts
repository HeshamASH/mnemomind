import { ElasticResult, Source } from '../types';
import { blobToDataURL } from '../utils/fileUtils';

const API_BASE_URL = '/api';

const handleApiError = async (response: Response, errorMessage: string) => {
    const clonedResponse = response.clone(); // Clone the response
    let errorBody;
    try {
        errorBody = await response.json();
    } catch (e) {
        const textBody = await clonedResponse.text(); // Use the cloned response here
        console.error(`${errorMessage}: ${response.statusText}`, textBody);
        throw new Error(`${errorMessage}: ${response.statusText} - Response was not valid JSON. Check console for details.`);
    }

    const errorDetails = JSON.stringify(errorBody);
    console.error(`${errorMessage}: ${response.statusText}`, errorDetails);
    throw new Error(`${errorMessage}: ${response.statusText} - Check browser console for details.`);
};

export const searchCloudDocuments = async (query: string): Promise<ElasticResult[]> => {
    console.log(`[API] Searching cloud for: "${query}"`);
    const endpoint = `${API_BASE_URL}/search`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) await handleApiError(response, 'API search request failed');
        return await response.json();
    } catch (error) {
        console.error("Error searching cloud documents:", error);
        throw error;
    }
};

export const getCloudFileContent = async (source: Source): Promise<string> => {
    console.log(`[API] Fetching cloud content for: "${source.file_name}"`);
    const endpoint = `${API_BASE_URL}/files/${encodeURIComponent(source.id)}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) await handleApiError(response, 'Failed to fetch file content from API');
        const data = await response.json();
        return data.content || "Content field not found in document.";
    } catch (error) {
        console.error("Error fetching cloud file content:", error);
        throw error;
    }
};

export const getAllCloudFiles = async (): Promise<Source[]> => {
    console.log(`[API] Fetching all cloud files`);
    const endpoint = `${API_BASE_URL}/files`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) await handleApiError(response, 'Failed to fetch all files from API');
        return await response.json();
    } catch (error) {
        console.error("Error fetching all cloud files:", error);
        throw error;
    }
};

// --- Preloaded (Client-Side) Data Handling (remains unchanged) ---

export const createDatasetFromSources = async (files: File[]): Promise<ElasticResult[]> => {
    console.log('[Client-side] Creating dataset from', files.length, 'files.');
    const dataset: ElasticResult[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let content: string;
        if (file.type === 'application/pdf') {
            content = await blobToDataURL(file);
        } else {
            content = await file.text();
        }
        dataset.push({
            source: {
                id: `custom-${file.name}-${file.lastModified}`,
                file_name: file.name,
                path: '',
            },
            contentSnippet: content,
            score: 1.0, // Default score for preloaded files
        });
    }
    return dataset;
};

export const searchPreloadedDocuments = (query: string, dataset: ElasticResult[]): ElasticResult[] => {
    console.log(`[Client-side] Searching for: "${query}" in preloaded data.`);
    const lowerCaseQuery = query.toLowerCase();
    return dataset
        .map(doc => {
            const score = (doc.contentSnippet.toLowerCase().match(new RegExp(lowerCaseQuery, 'g')) || []).length;
            return { ...doc, score };
        })
        .filter(doc => doc.score > 0)
        .sort((a, b) => b.score - a.score);
};

export const getAllPreloadedFiles = (dataset: ElasticResult[]): Source[] => {
    return Array.from(new Map(dataset.map(doc => [doc.source.id, doc.source])).values());
};

export const getPreloadedFileContent = (source: Source, dataset: ElasticResult[]): string | null => {
    const doc = dataset.find(d => d.source.id === source.id);
    return doc ? doc.contentSnippet.trim() : null;
};

export const updateFileContent = (source: Source, newContent: string, dataset: ElasticResult[]): {success: boolean, newDataset: ElasticResult[]} => {
    console.log(`[Client-side] Updating content for: "${source.file_name}" (id: ${source.id})`);
    let found = false;
    const newDataset = dataset.map(doc => {
        if (doc.source.id === source.id) {
            found = true;
            return { ...doc, contentSnippet: newContent };
        }
        return doc;
    });

    if (found) {
         return { success: true, newDataset };
    } else {
        console.error(`[Client-side] Could not find file to update with id: ${source.id}`);
        return { success: false, newDataset: dataset };
    }
};