import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataSource, Theme } from '../../../types';
import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    ThemeSwitcherComponent
  ]
})
export class HeaderComponent {
  @Input() theme: Theme = 'light';
  @Input() activeDataSource: DataSource | null = null;
  @Output() toggleFileSearch = new EventEmitter<void>();
  @Output() toggleEditedFiles = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() connectDataSource = new EventEmitter<void>();
  @Output() themeChange = new EventEmitter<Theme>();

  onToggleFileSearch(): void {
    this.toggleFileSearch.emit();
  }

  onToggleEditedFiles(): void {
    this.toggleEditedFiles.emit();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onConnectDataSource(): void {
    this.connectDataSource.emit();
  }

  setTheme(theme: Theme): void {
    this.themeChange.emit(theme);
  }
}
