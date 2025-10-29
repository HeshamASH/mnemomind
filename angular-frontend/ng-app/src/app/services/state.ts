import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Chat, ChatMessage, DataSource, Theme } from '../../types';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly _chats$ = new BehaviorSubject<Chat[]>([]);
  private readonly _activeChatId$ = new BehaviorSubject<string | null>(null);
  private readonly _theme$ = new BehaviorSubject<Theme>('light');
  private readonly _isSidebarOpen$ = new BehaviorSubject<boolean>(true);
  private readonly _isFileSearchVisible$ = new BehaviorSubject<boolean>(false);
  private readonly _isEditedFilesVisible$ = new BehaviorSubject<boolean>(false);
  private readonly _activeDataSource$ = new BehaviorSubject<DataSource | null>(null);

  readonly chats$ = this._chats$.asObservable();
  readonly activeChatId$ = this._activeChatId$.asObservable();
  readonly activeChat$: Observable<Chat | null> = this._activeChatId$.pipe(
    map(activeId => this._chats$.value.find(chat => chat.id === activeId) || null)
  );
  readonly theme$ = this._theme$.asObservable();
  readonly isSidebarOpen$ = this._isSidebarOpen$.asObservable();
  readonly isFileSearchVisible$ = this._isFileSearchVisible$.asObservable();
  readonly isEditedFilesVisible$ = this._isEditedFilesVisible$.asObservable();
  readonly activeDataSource$ = this._activeDataSource$.asObservable();

  setChats(chats: Chat[]): void {
    this._chats$.next(chats);
  }

  setActiveChatId(chatId: string | null): void {
    this._activeChatId$.next(chatId);
  }

  setTheme(theme: Theme): void {
    this._theme$.next(theme);
  }

  toggleSidebar(): void {
    this._isSidebarOpen$.next(!this._isSidebarOpen$.value);
  }

  toggleFileSearch(): void {
    this._isFileSearchVisible$.next(!this._isFileSearchVisible$.value);
  }

  toggleEditedFiles(): void {
    this._isEditedFilesVisible$.next(!this._isEditedFilesVisible$.value);
  }

  setActiveDataSource(dataSource: DataSource | null): void {
    this._activeDataSource$.next(dataSource);
  }

  addChat(chat: Chat): void {
    const chats = this._chats$.value;
    this._chats$.next([chat, ...chats]);
    this.setActiveChatId(chat.id);
  }

  addMessage(message: ChatMessage): void {
    const activeId = this._activeChatId$.value;
    if (!activeId) {
      return;
    }

    const chats = this._chats$.value.map(chat => {
      if (chat.id === activeId) {
        return {
          ...chat,
          messages: [...chat.messages, message]
        };
      }
      return chat;
    });
    this._chats$.next(chats);
  }

  updateLastMessage(message: ChatMessage): void {
    const activeId = this._activeChatId$.value;
    if (!activeId) {
      return;
    }

    const chats = this._chats$.value.map(chat => {
      if (chat.id === activeId) {
        const messages = [...chat.messages];
        messages[messages.length - 1] = message;
        return {
          ...chat,
          messages
        };
      }
      return chat;
    });
    this._chats$.next(chats);
  }

  deleteChat(chatId: string): void {
    const chats = this._chats$.value.filter(chat => chat.id !== chatId);
    this._chats$.next(chats);

    if (this._activeChatId$.value === chatId) {
      const newActiveId = chats.length > 0 ? chats[0].id : null;
      this.setActiveChatId(newActiveId);
    }
  }
}
