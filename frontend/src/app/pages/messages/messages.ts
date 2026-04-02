import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { ConversationSummary, MessageSocketService, PrivateMessage } from '../../services/message-socket.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class MessagesPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly messageService = inject(MessageSocketService);

  messageInput = signal('');
  pageError = signal<string | null>(null);

  private querySubscription: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    try {
      await this.messageService.initialize();

      this.querySubscription = this.route.queryParamMap.subscribe((params) => {
        const recipientId = (params.get('recipientId') ?? params.get('ownerId'))?.trim() ?? null;

        if (recipientId) {
          void this.messageService
            .ensureConversationFromRoute(recipientId)
            .catch(() => {
              this.pageError.set('Unable to open this private conversation.');
            });
        }
      });
    } catch (error) {
      this.pageError.set(error instanceof Error ? error.message : 'Unable to load conversations.');
    }
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
  }

  async selectConversation(conversation: ConversationSummary): Promise<void> {
    this.pageError.set(null);

    try {
      await this.messageService.selectConversationById(conversation.id);
    } catch (error) {
      this.pageError.set(error instanceof Error ? error.message : 'Unable to load messages.');
    }
  }

  updateMessageInput(value: string): void {
    this.messageInput.set(value);
  }

  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.messageInput().trim();

    if (!text) {
      return;
    }

    try {
      await this.messageService.sendTextMessage(text);
      this.messageInput.set('');
      await this.messageService.refreshConversations();
    } catch (error) {
      this.pageError.set(error instanceof Error ? error.message : 'Unable to send message.');
    }
  }

  isMine(message: PrivateMessage): boolean {
    return this.messageService.isCurrentUserMessage(message);
  }

  asDate(value: string): Date {
    return this.messageService.asDate(value);
  }

  get selectedConversationId(): string | null {
    return this.messageService.getSelectedConversationId();
  }

  get conversations(): ConversationSummary[] {
    return this.messageService.getConversations();
  }

  get messages(): PrivateMessage[] {
    return this.messageService.getMessages();
  }

  get selectedConversation(): ConversationSummary | null {
    return this.messageService.getSelectedConversation();
  }

  get isConnected(): boolean {
    return this.messageService.getConnectionState();
  }

  get currentUserId(): string {
    return this.messageService.getCurrentUserId();
  }

  get isLoadingConversations(): boolean {
    return this.messageService.getLoadingConversations();
  }

  get isLoadingMessages(): boolean {
    return this.messageService.getLoadingMessages();
  }
}
