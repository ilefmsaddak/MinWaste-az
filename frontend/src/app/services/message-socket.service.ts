import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { getHttpOriginFromApiBase } from './api.config';

export interface PrivateMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  otherParticipant: {
    id: string;
    displayName: string;
  };
  updatedAt: string;
  createdAt: string;
  lastMessage: {
    id: string;
    text: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
}

export interface ChatUserSummary {
  id: string;
  displayName: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class MessageSocketService {
  private readonly http = inject(HttpClient);
  private readonly socket: Socket;
  /** Same key as login/profile (`users.id` UUID). */
  private readonly storageKey = 'userId';

  private chatHttpBase(): string {
    return `${getHttpOriginFromApiBase()}/chat`;
  }

  private socketOrigin(): string {
    return `${getHttpOriginFromApiBase()}/messages`;
  }

  readonly currentUserId = signal(this.resolveCurrentUserId());
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly selectedConversationId = signal<string | null>(null);
  readonly messages = signal<PrivateMessage[]>([]);
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly connected = signal(false);
  readonly unreadConversations = signal<Record<string, number>>({});

  readonly selectedConversation = computed(() =>
    this.conversations().find((conversation) => conversation.id === this.selectedConversationId()) ?? null,
  );

  readonly unreadMessagesCount = computed(() =>
    Object.values(this.unreadConversations()).reduce((sum, count) => sum + count, 0),
  );

  constructor() {
    this.socket = io(this.socketOrigin(), {
      transports: ['websocket'],
      autoConnect: false,
      auth: {
        userId: this.currentUserId(),
      },
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.socket.emit('chat.join', { userId: this.currentUserId() });
    });

    this.socket.on('disconnect', () => {
      this.connected.set(false);
    });

    this.socket.on('chat.message', (message: PrivateMessage) => {
      if (!message || !message.conversationId) {
        return;
      }

      this.conversations.update((currentConversations) =>
        currentConversations
          .map((conversation) => {
            if (conversation.id !== message.conversationId) {
              return conversation;
            }

            return {
              ...conversation,
              updatedAt: message.createdAt,
              lastMessage: {
                id: message.id,
                text: message.text,
                createdAt: message.createdAt,
                senderId: message.senderId,
                senderName:
                  message.senderId === this.currentUserId()
                    ? 'You'
                    : conversation.otherParticipant.displayName,
              },
            };
          })
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
      );

      if (this.selectedConversationId() === message.conversationId) {
        this.messages.update((currentMessages) => {
          if (currentMessages.some((existingMessage) => existingMessage.id === message.id)) {
            return currentMessages;
          }

          return [...currentMessages, message];
        });

        return;
      }

      this.unreadConversations.update((currentUnreadConversations) => ({
        ...currentUnreadConversations,
        [message.conversationId]: (currentUnreadConversations[message.conversationId] ?? 0) + 1,
      }));
    });
  }

  async loadConversations(): Promise<void> {
    this.assertLoggedInUserId();

    this.loadingConversations.set(true);

    try {
      const userId = this.currentUserId();
      const params = new HttpParams().set('userId', userId);
      const conversations = await firstValueFrom(
        this.http.get<ConversationSummary[]>(`${this.chatHttpBase()}/conversations`, { params }),
      );
      this.conversations.set(conversations ?? []);
    } finally {
      this.loadingConversations.set(false);
    }
  }

  async openConversationWithUser(otherUserId: string): Promise<void> {
    const normalizedOtherUserId = otherUserId?.trim();

    if (!normalizedOtherUserId) {
      return;
    }

    const payload: { currentUserId: string; otherUserId: string } = {
      currentUserId: this.currentUserId(),
      otherUserId: normalizedOtherUserId,
    };

    const openedConversation = await firstValueFrom(
      this.http.post<ConversationSummary>(`${this.chatHttpBase()}/conversations/open`, payload),
    );

    this.conversations.update((currentConversations) => {
      const withoutOpenedConversation = currentConversations.filter(
        (conversation) => conversation.id !== openedConversation.id,
      );
      return [openedConversation, ...withoutOpenedConversation];
    });

    await this.selectConversation(openedConversation.id);
  }

  async selectConversation(conversationId: string): Promise<void> {
    this.selectedConversationId.set(conversationId);
    this.loadingMessages.set(true);

    try {
      const params = new HttpParams()
        .set('conversationId', conversationId)
        .set('userId', this.currentUserId());

      const conversationMessages = await firstValueFrom(
        this.http.get<PrivateMessage[]>(`${this.chatHttpBase()}/messages`, { params }),
      );

      this.messages.set(conversationMessages ?? []);
      this.unreadConversations.update((currentUnreadConversations) => {
        const nextUnreadConversations = { ...currentUnreadConversations };
        delete nextUnreadConversations[conversationId];
        return nextUnreadConversations;
      });
    } finally {
      this.loadingMessages.set(false);
    }
  }

  async sendMessage(text: string): Promise<void> {
    const conversationId = this.selectedConversationId();
    const normalizedText = text.trim();

    if (!conversationId || !normalizedText) {
      return;
    }

    const created = await firstValueFrom(
      this.http.post<PrivateMessage>(`${this.chatHttpBase()}/messages`, {
        conversationId,
        senderId: this.currentUserId(),
        text: normalizedText,
      }),
    );

    if (created?.id && this.selectedConversationId() === created.conversationId) {
      this.messages.update((currentMessages) => {
        if (currentMessages.some((m) => m.id === created.id)) {
          return currentMessages;
        }
        return [...currentMessages, created];
      });
      this.conversations.update((currentConversations) =>
        currentConversations
          .map((conversation) => {
            if (conversation.id !== created.conversationId) {
              return conversation;
            }
            return {
              ...conversation,
              updatedAt: created.createdAt,
              lastMessage: {
                id: created.id,
                text: created.text,
                createdAt: created.createdAt,
                senderId: created.senderId,
                senderName: 'You',
              },
            };
          })
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
      );
    }
  }

  /**
   * Connects Socket.IO when `userId` is in storage so incoming messages update the nav badge
   * without visiting /messages first.
   */
  ensureSocketConnected(): void {
    const id = this.resolveCurrentUserId();
    if (!id) {
      return;
    }
    this.currentUserId.set(id);
    this.socket.auth = { userId: id };
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  private resolveCurrentUserId(): string {
    return localStorage.getItem(this.storageKey)?.trim() ?? '';
  }

  private assertLoggedInUserId(): void {
    const id = this.resolveCurrentUserId();
    if (!id) {
      throw new Error(
        'Connectez-vous et ouvrez la page Profil une fois pour enregistrer votre identifiant (messagerie).',
      );
    }
    this.currentUserId.set(id);
  }

  setCurrentUserId(userId: string): void {
    const normalizedUserId = userId?.trim();

    if (!normalizedUserId || normalizedUserId === this.currentUserId()) {
      return;
    }

    this.currentUserId.set(normalizedUserId);
    localStorage.setItem(this.storageKey, normalizedUserId);

    this.socket.auth = {
      userId: normalizedUserId,
    };
    this.socket.connect();

    this.messages.set([]);
    this.selectedConversationId.set(null);
    this.unreadConversations.set({});

    void this.loadConversations();
  }

  async initialize(): Promise<void> {
    this.assertLoggedInUserId();

    this.socket.auth = {
      userId: this.currentUserId(),
    };

    this.socket.connect();
    await this.loadConversations();

    const firstConversationId = this.conversations()[0]?.id;
    if (firstConversationId) {
      await this.selectConversation(firstConversationId);
    }
  }

  async ensureConversationFromRoute(otherUserId?: string | null): Promise<void> {
    const normalizedOtherUserId = otherUserId?.trim();

    if (!normalizedOtherUserId) {
      return;
    }

    await this.openConversationWithUser(normalizedOtherUserId);
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  reconnect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  asDate(value: string): Date {
    return new Date(value);
  }

  isCurrentUserMessage(message: PrivateMessage): boolean {
    return message.senderId === this.currentUserId();
  }

  trackByConversation(_index: number, conversation: ConversationSummary): string {
    return conversation.id;
  }

  trackByMessage(_index: number, message: PrivateMessage): string {
    return message.id;
  }

  refreshConversations(): Promise<void> {
    return this.loadConversations();
  }

  connectNow(): void {
    this.reconnect();
  }

  selectConversationById(conversationId: string): Promise<void> {
    return this.selectConversation(conversationId);
  }

  openConversation(otherUserId: string): Promise<void> {
    return this.openConversationWithUser(otherUserId);
  }

  sendTextMessage(text: string): Promise<void> {
    return this.sendMessage(text);
  }

  getCurrentUserId(): string {
    return this.currentUserId();
  }

  getConnectionState(): boolean {
    return this.connected();
  }

  getUnreadCount(): number {
    return this.unreadMessagesCount();
  }

  getSelectedConversationId(): string | null {
    return this.selectedConversationId();
  }

  getConversations(): ConversationSummary[] {
    return this.conversations();
  }

  getMessages(): PrivateMessage[] {
    return this.messages();
  }

  getSelectedConversation() {
    return this.selectedConversation();
  }

  getLoadingConversations(): boolean {
    return this.loadingConversations();
  }

  getLoadingMessages(): boolean {
    return this.loadingMessages();
  }

  getUnreadConversations(): Record<string, number> {
    return this.unreadConversations();
  }

  clearUnreadForConversation(conversationId: string): void {
    this.unreadConversations.update((currentUnreadConversations) => {
      const nextUnreadConversations = { ...currentUnreadConversations };
      delete nextUnreadConversations[conversationId];
      return nextUnreadConversations;
    });
  }
}
