import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';
import { StateService } from '../../services/state';
import { GeminiService } from '../../services/gemini';
import { Chat, ChatMessage, DataSource, Intent, MessageRole, ResponseType } from '../../../types';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-chat-interface',
  templateUrl: './chat-interface.html',
  styleUrls: ['./chat-interface.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class ChatInterfaceComponent implements OnInit {
  messages$!: Observable<ChatMessage[]>;
  activeDataSource$!: Observable<DataSource | null>;
  input = '';
  isLoading = false;

  constructor(private stateService: StateService, private geminiService: GeminiService) {}

  ngOnInit(): void {
    this.messages$ = this.stateService.activeChat$.pipe(
      switchMap(chat => new Observable<ChatMessage[]>(observer => {
        observer.next(chat ? chat.messages : []);
      }))
    );
    this.activeDataSource$ = this.stateService.activeDataSource$;
  }

  async onSendMessage(): Promise<void> {
    if (this.isLoading || !this.input.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      role: MessageRole.USER,
      content: this.input,
      responseType: ResponseType.RAG,
      modelId: 'gemini-pro'
    };

    this.stateService.addMessage(userMessage);
    const currentInput = this.input;
    this.input = '';
    this.isLoading = true;

    try {
      const activeChat = await firstValueFrom(this.stateService.activeChat$);
      if (!activeChat) {
        throw new Error('No active chat');
      }
      const history = activeChat.messages;

      const intent = await this.geminiService.classifyIntent(currentInput, 'gemini-pro');

      let stream;
      if (intent === Intent.CHIT_CHAT) {
        stream = await this.geminiService.streamChitChatResponse(history, 'gemini-pro');
      } else {
        stream = await this.geminiService.streamAiResponse(history, [], 'gemini-pro', {
          useCloud: false,
          usePreloaded: false,
          useGoogleSearch: false,
          useGoogleMaps: false
        });
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let response = '';
      const modelMessage: ChatMessage = {
        role: MessageRole.MODEL,
        content: '',
        responseType: ResponseType.RAG,
        modelId: 'gemini-pro'
      };
      this.stateService.addMessage(modelMessage);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        response += decoder.decode(value);
        modelMessage.content = response;
        this.stateService.updateLastMessage(modelMessage);
      }
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        role: MessageRole.MODEL,
        content: 'An error occurred. Please try again.',
        responseType: ResponseType.ERROR,
        modelId: 'gemini-pro'
      };
      this.stateService.addMessage(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }
}
