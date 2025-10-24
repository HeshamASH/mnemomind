// --- Base Enums and Types ---

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system' // Optional: If you need explicit system messages
}

export enum Intent {
  QUERY_DOCUMENTS = 'query_documents',
  GENERATE_CODE = 'generate_code',
  CHIT_CHAT = 'chit_chat',
  UNKNOWN = 'unknown'
}

export enum ResponseType {
  RAG = 'RAG', // Based on Elastic/Preloaded data
  CODE_GENERATION = 'Code Generation',
  CHIT_CHAT = 'Chit-Chat',
  GOOGLE_SEARCH = 'Web Search', // For web grounding results
  GOOGLE_MAPS = 'Maps Search',   // For maps grounding results
  ERROR = 'Error'
}

export enum ModelId {
  GEMINI_FLASH_LITE = 'gemini-flash-lite',
  GEMINI_FLASH = 'gemini-flash',
  GEMINI_PRO = 'gemini-pro'
}

export type Theme = 'light' | 'dark';

// --- Interfaces ---

export interface GroundingOptions {
  useCloud: boolean;      // Use Elasticsearch Cloud
  usePreloaded: boolean;  // Use client-side dataset
  useGoogleSearch: boolean; // Use Google Search via Gemini API
  useGoogleMaps: boolean;   // Use Google Maps via Gemini API (if supported/configured)
}

// Represents grounding sources from Gemini API (Web/Maps)
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    reviewSnippets?: {
      text: string;
      uri: string;
      title: string;
    }[];
  };
  // Add other potential grounding types if needed
}

export interface ModelDefinition {
  id: ModelId;
  name: string;
  model: string; // The actual model string for the API call
}

export const MODELS: ModelDefinition[] = [
  {
    id: ModelId.GEMINI_FLASH_LITE,
    name: '2.5 Flash Lite',
    model: 'gemini-flash-lite-latest' // Use appropriate model identifier
  },
  {
    id: ModelId.GEMINI_FLASH,
    name: '2.5 Flash',
    model: 'models/gemini-1.5-flash-latest' // Example identifier, adjust as needed
  },
  {
    id: ModelId.GEMINI_PRO,
    name: '2.5 Pro',
    model: 'models/gemini-1.5-pro-latest' // Example identifier, adjust as needed
  }
];

// Represents a file source (from Elastic, Preloaded, Drive etc.)
export interface Source {
  id: string; // Unique identifier (Elastic ID, local ID, Drive ID)
  fileName: string;
  path: string; // Directory path or source indicator (e.g., "Google Drive")
}

// Represents a code change suggestion from the AI
export interface CodeSuggestion {
  file: Source; // The target file
  thought: string; // AI's explanation of the change
  originalContent: string; // Content before suggestion
  suggestedContent: string; // Full file content with suggestion applied
  status: 'pending' | 'accepted' | 'rejected'; // User action status
}

// Represents a file attached by the user
export interface Attachment {
    name: string;
    type: string; // Mime type (e.g., "image/png", "application/pdf")
    size: number; // Size in bytes
    content: string; // Base64 encoded content
}

// Represents a single message in the chat history
export interface ChatMessage {
  role: MessageRole;
  content: string; // The text content of the message
  attachment?: Attachment; // Optional user attachment
  // Sources retrieved from Elastic/Preloaded for RAG
  elasticSources?: ElasticResult[]; // Holds full results including snippets
  // Sources retrieved via Gemini API grounding (Web/Maps)
  groundingChunks?: GroundingChunk[];
  // AI-generated code change suggestion
  suggestion?: CodeSuggestion;
  // File that was edited by accepting a suggestion
  editedFile?: Source;
  // Type of response (RAG, Chit-Chat, etc.) for metadata display
  responseType?: ResponseType;
  // Model used for the response
  modelId?: ModelId;
}

// Represents the source of data for a chat (folder, files, drive)
export interface DataSource {
  type: 'folder' | 'files' | 'drive'; // Removed 'database' for now
  name: string; // Display name (e.g., folder name, "5 Files", "Google Drive")
  fileCount: number; // Number of files associated
}

// Represents a file from Google Drive (subset of Drive API file resource)
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string; // Optional modification time
    webViewLink?: string;  // Optional link to view in browser
}

// Represents a full chat session
export interface Chat {
  id: string; // Unique ID for the chat session
  title: string; // Chat title (e.g., first user message or data source name)
  messages: ChatMessage[]; // Array of messages in the chat
  createdAt: number; // Timestamp of creation
  dataSource: DataSource | null; // Linked data source, if any
  // Client-side dataset (for 'folder'/'files' type data sources)
  dataset: ElasticResult[];
  // Grounding settings for this specific chat
  groundingOptions: GroundingOptions;
}

// Represents a single search result from Elasticsearch (or simulated for client-side)
export interface ElasticResult {
  source: Source; // File information
  contentSnippet: string; // The relevant text chunk or highlighted snippet
  score: number; // Relevance score from the search
}

