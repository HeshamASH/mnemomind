import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Theme } from '../../../types';

@Component({
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.html',
  styleUrls: ['./theme-switcher.scss'],
  standalone: true,
  imports: [CommonModule, MatSlideToggleModule, MatIconModule]
})
export class ThemeSwitcherComponent {
  @Input() theme: Theme = 'light';
  @Output() themeChange = new EventEmitter<Theme>();

  toggleTheme(): void {
    this.themeChange.emit(this.theme === 'dark' ? 'light' : 'dark');
  }
}
