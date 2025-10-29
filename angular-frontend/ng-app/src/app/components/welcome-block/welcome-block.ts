import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-welcome-block',
  templateUrl: './welcome-block.html',
  styleUrls: ['./welcome-block.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule]
})
export class WelcomeBlockComponent {
  @Output() connectDataSource = new EventEmitter<void>();

  onConnect(): void {
    this.connectDataSource.emit();
  }
}
