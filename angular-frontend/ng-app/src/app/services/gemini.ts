import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ElasticResult, Intent, ChatMessage, GroundingOptions } from '../../types';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly API_BASE_URL = '/api/gemini';

  constructor(private http: HttpClient) { }

  async classifyIntent(userQuery: string, model: string): Promise<Intent> {
    const response = await firstValueFrom(this.http.post<{ intent: Intent }>(`${this.API_BASE_URL}/classify-intent`, { query: userQuery, model }));
    return response.intent;
  }

  async streamChitChatResponse(history: ChatMessage[], model: string): Promise<any> {
    const response = await fetch(`${this.API_BASE_URL}/stream-chit-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history, model }),
    });
    return response.body;
  }

  async streamAiResponse(
    history: ChatMessage[],
    context: ElasticResult[],
    model: string,
    groundingOptions: GroundingOptions
  ): Promise<any> {
    const response = await fetch(`${this.API_BASE_URL}/stream-ai-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history, context, model, groundingOptions }),
    });
    return response.body;
  }
}
