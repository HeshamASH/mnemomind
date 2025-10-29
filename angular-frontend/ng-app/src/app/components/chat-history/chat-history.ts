import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { Observable } from 'rxjs';
import { StateService } from '../../services/state';
import { Chat, DataSource, Source } from '../../../types';

interface FileNode {
  name: string;
  children?: FileNode[];
  source?: Source;
}

@Component({
  selector: 'app-chat-history',
  templateUrl: './chat-history.html',
  styleUrls: ['./chat-history.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatTreeModule
  ]
})
export class ChatHistoryComponent implements OnInit {
  @Input()
  set files(files: Source[]) {
    this.dataSource.data = this.buildFileTree(files);
  }
  @Output() selectFile = new EventEmitter<Source>();
  @Output() newChat = new EventEmitter<void>();

  treeControl = new NestedTreeControl<FileNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<FileNode>();

  chats$!: Observable<Chat[]>;
  activeChatId$!: Observable<string | null>;
  activeDataSource$!: Observable<DataSource | null>;

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.chats$ = this.stateService.chats$;
    this.activeChatId$ = this.stateService.activeChatId$;
    this.activeDataSource$ = this.stateService.activeDataSource$;
  }

  hasChild = (_: number, node: FileNode) => !!node.children && node.children.length > 0;

  onNewChat(): void {
    this.newChat.emit();
  }

  onSelectChat(id: string): void {
    this.stateService.setActiveChatId(id);
  }

  onDeleteChat(event: MouseEvent, chatId: string): void {
    event.stopPropagation();
    this.stateService.deleteChat(chatId);
  }

  onSelectFile(file: Source): void {
    this.selectFile.emit(file);
  }

  private buildFileTree(files: Source[]): FileNode[] {
    const root: FileNode = { name: 'root', children: [] };

    for (const file of files) {
      const pathParts = file.path.split('/');
      let currentNode = root;

      for (const part of pathParts) {
        if (!part) {
          continue;
        }

        let childNode = currentNode.children?.find(node => node.name === part);
        if (!childNode) {
          childNode = { name: part, children: [] };
          if (!currentNode.children) {
            currentNode.children = [];
          }
          currentNode.children.push(childNode);
        }
        currentNode = childNode;
      }

      if (!currentNode.children) {
        currentNode.children = [];
      }
      currentNode.children.push({ name: file.fileName, source: file });
    }

    return root.children || [];
  }
}
