import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header';
import { StateService } from './services/state';
import { Subscription } from 'rxjs';
import { Theme, DataSource, Chat } from '../types';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ChatHistoryComponent } from './components/chat-history/chat-history';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface';
import { WelcomeBlockComponent } from './components/welcome-block/welcome-block';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    MatSidenavModule,
    ChatHistoryComponent,
    ChatInterfaceComponent,
    WelcomeBlockComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true
})
export class App implements OnInit, OnDestroy {
  theme: Theme = 'light';
  activeDataSource: DataSource | null = null;
  isSidebarOpen = true;
  private subscriptions = new Subscription();

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.subscriptions.add(this.stateService.theme$.subscribe(theme => this.theme = theme));
    this.subscriptions.add(this.stateService.activeDataSource$.subscribe(dataSource => this.activeDataSource = dataSource));
    this.subscriptions.add(this.stateService.isSidebarOpen$.subscribe(isOpen => this.isSidebarOpen = isOpen));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  toggleSidebar(): void {
    this.stateService.toggleSidebar();
  }

  toggleFileSearch(): void {
    this.stateService.toggleFileSearch();
  }

  toggleEditedFiles(): void {
    this.stateService.toggleEditedFiles();
  }

  connectDataSource(): void {
    window.location.href = '/api/auth/google';
  }

  setTheme(theme: Theme): void {
    this.stateService.setTheme(theme);
  }

  newChat(): void {
    const newChat: Chat = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      dataSource: null,
      dataset: [],
      groundingOptions: {
        useCloud: false,
        usePreloaded: false,
        useGoogleSearch: false,
        useGoogleMaps: false
      }
    };
    this.stateService.addChat(newChat);
  }
}
