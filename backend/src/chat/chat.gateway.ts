import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ChatMessage } from './chat.types';
import type { SendChatMessagePayload } from './chat.types';

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket): void {
    const rawUserId =
      client.handshake.auth?.['userId'] ?? client.handshake.query?.['userId'];
    const userId =
      typeof rawUserId === 'string'
        ? rawUserId
        : Array.isArray(rawUserId)
          ? rawUserId[0]
          : undefined;

    if (userId) {
      client.join(this.getUserRoom(userId));
      this.logger.debug(`Socket ${client.id} joined user:${userId}`);
    }
  }

  @SubscribeMessage('chat.join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId?: string },
  ): void {
    const userId = payload?.userId?.trim();
    if (!userId) return;
    client.join(this.getUserRoom(userId));
  }

  @SubscribeMessage('chat.send')
  async handleSendMessage(
    @MessageBody() payload: SendChatMessagePayload,
  ): Promise<ChatMessage | null> {
    if (!payload?.conversationId || !payload?.senderId || !payload?.text) {
      return null;
    }

    const message = await this.chatService.createMessage(
      payload.conversationId,
      payload.senderId,
      payload.text,
    );
    this.emitPrivateMessage(message);
    return message;
  }

  emitPrivateMessage(message: ChatMessage): void {
    this.server.to(this.getUserRoom(message.senderId)).emit('chat.message', message);
    this.server.to(this.getUserRoom(message.recipientId)).emit('chat.message', message);
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
