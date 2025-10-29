export type Theme = 'light' | 'dark';

export interface DataSource {
  name: string;
  fileCount: number;
}

export interface ElasticResult {
  source: Source;
  contentSnippet: string;
  score: number;
}

export interface Source {
  id: string;
  fileName: string;
  path: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  dataSource: DataSource | null;
  dataset: ElasticResult[];
  groundingOptions: GroundingOptions;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  responseType: ResponseType;
  modelId: string;
  elasticSources?: ElasticResult[];
  groundingChunks?: GroundingChunk[];
  attachment?: Attachment;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export enum ResponseType {
  RAG = 'rag',
  CHIT_CHAT = 'chit_chat',
  CODE_GENERATION = 'code_generation',
  GOOGLE_MAPS = 'google_maps',
  GOOGLE_SEARCH = 'google_search',
  ERROR = 'error',
  INFO = 'info',
  CODE_APPLIED = 'code_applied',
}

export interface GroundingOptions {
  useCloud: boolean;
  usePreloaded: boolean;
  useGoogleSearch: boolean;
  useGoogleMaps: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface Attachment {
  name: string;
  type: string;
  content: string;
}

export enum Intent {
  QUERY_DOCUMENTS = 'query_documents',
  GENERATE_CODE = 'generate_code',
  CHIT_CHAT = 'chit_chat',
  UNKNOWN = 'unknown',
}
