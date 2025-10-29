import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ElasticResult, Source } from '../../types';

@Injectable({
  providedIn: 'root'
})
export class ElasticService {
  private readonly API_BASE_URL = '/api';

  constructor(private http: HttpClient) { }

  async searchCloudDocuments(query: string): Promise<ElasticResult[]> {
    console.log(`[API] Searching cloud for: "${query}"`);
    const endpoint = `${this.API_BASE_URL}/search`;

    try {
      const response = await firstValueFrom(this.http.post<ElasticResult[]>(endpoint, { query }));
      return response;
    } catch (error) {
      throw await this.handleApiError(error, 'API search request failed');
    }
  }

  async getCloudFileContent(source: Source): Promise<string> {
    console.log(`[API] Fetching cloud content for: "${source.fileName}" (ID: ${source.id})`);
    const endpoint = `${this.API_BASE_URL}/files/${source.id}`;

    try {
      const response = await firstValueFrom(this.http.get<{ content: string }>(endpoint));
      return response.content;
    } catch (error) {
      throw await this.handleApiError(error, `Failed to fetch content for ${source.fileName}`);
    }
  }

  async getAllCloudFiles(): Promise<Source[]> {
    console.log(`[API] Fetching all cloud files list`);
    const endpoint = `${this.API_BASE_URL}/files`;

    try {
      const response = await firstValueFrom(this.http.get<Source[]>(endpoint));
      return response;
    } catch (error) {
      throw await this.handleApiError(error, 'Failed to fetch file list from API');
    }
  }

  createDatasetFromSources(files: File[]): Promise<ElasticResult[]> {
    // This will be implemented in a future step
    return Promise.resolve([]);
  }

  searchPreloadedDocuments(query: string, dataset: ElasticResult[]): ElasticResult[] {
    // This will be implemented in a future step
    return [];
  }

  getAllPreloadedFiles(dataset: ElasticResult[]): Source[] {
    // This will be implemented in a future step
    return [];
  }

  getPreloadedFileContent(source: Source, dataset: ElasticResult[]): string | null {
    // This will be implemented in a future step
    return null;
  }

  updateFileContent(source: Source, newContent: string, dataset: ElasticResult[]): { success: boolean; newDataset: ElasticResult[] } {
    // This will be implemented in a future step
    return { success: false, newDataset: dataset };
  }

  private async handleApiError(error: any, contextMessage: string): Promise<Error> {
    let errorDetails = `Status: ${error.status} ${error.statusText}`;
    if (error.error) {
      errorDetails += ` - Detail: ${error.error.detail || JSON.stringify(error.error)}`;
    }
    const errorMessage = `${contextMessage}. ${errorDetails}`;
    console.error(errorMessage);
    return new Error(contextMessage);
  }
}
