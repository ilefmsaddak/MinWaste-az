import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatMessage } from './chat.types';

interface OpenConversationInput {
  currentUserId: string;
  otherUserId: string;
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

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getAvailableUsers(limit = 20): Promise<ChatUserSummary[]> {
    const users = await this.prisma.users.findMany({
      where: { is_suspended: false },
      select: {
        id: true,
        display_name: true,
        email: true,
      },
      orderBy: { created_at: 'asc' },
      take: limit,
    });

    return users.map((user) => ({
      id: user.id,
      displayName: user.display_name?.trim() || `User ${user.id}`,
      email: user.email,
    }));
  }

  async openConversation(input: OpenConversationInput): Promise<ConversationSummary> {
    const currentUserId = this.normalizeUserId(input.currentUserId, 'currentUserId');
    const otherUserId = this.normalizeUserId(input.otherUserId, 'otherUserId');

    if (currentUserId === otherUserId) {
      throw new BadRequestException('You cannot open a conversation with yourself.');
    }

    const [currentUser, otherUser] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: currentUserId },
        select: { id: true, display_name: true },
      }),
      this.prisma.users.findUnique({
        where: { id: otherUserId },
        select: { id: true, display_name: true },
      }),
    ]);

    if (!currentUser || !otherUser) {
      throw new BadRequestException('One or both users do not exist.');
    }

    const [u1, u2] = this.orderUserIds(currentUserId, otherUserId);

    let convo = await this.prisma.conversations.findFirst({
      where: {
        user1_id: u1,
        user2_id: u2,
        item_id: null,
      },
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            users: { select: { id: true, display_name: true } },
          },
        },
      },
    });

    if (!convo) {
      convo = await this.prisma.conversations.create({
        data: {
          user1_id: u1,
          user2_id: u2,
          item_id: null,
          last_message_at: null,
        },
        include: {
          messages: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: {
              users: { select: { id: true, display_name: true } },
            },
          },
        },
      });
    }

    const last = convo.messages[0];

    return {
      id: convo.id,
      otherParticipant: {
        id: otherUser.id,
        displayName: otherUser.display_name?.trim() || `User ${otherUser.id}`,
      },
      updatedAt: (last?.created_at ?? convo.created_at).toISOString(),
      createdAt: convo.created_at.toISOString(),
      lastMessage: last
        ? {
            id: last.id,
            text: last.content,
            createdAt: last.created_at.toISOString(),
            senderId: last.sender_id,
            senderName:
              last.users.display_name?.trim() || `User ${last.sender_id}`,
          }
        : null,
    };
  }

  async getConversationsForUser(userId: string): Promise<ConversationSummary[]> {
    const normalizedUserId = this.normalizeUserId(userId, 'userId');

    const user = await this.prisma.users.findUnique({
      where: { id: normalizedUserId },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const convos = await this.prisma.conversations.findMany({
      where: {
        OR: [{ user1_id: normalizedUserId }, { user2_id: normalizedUserId }],
      },
      include: {
        users_conversations_user1_idTousers: {
          select: { id: true, display_name: true },
        },
        users_conversations_user2_idTousers: {
          select: { id: true, display_name: true },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            users: { select: { id: true, display_name: true } },
          },
        },
      },
      orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
    });

    const summaries: ConversationSummary[] = [];

    for (const c of convos) {
      const u1 = c.users_conversations_user1_idTousers;
      const u2 = c.users_conversations_user2_idTousers;
      const other =
        u1.id === normalizedUserId
          ? u2
          : u1;
      const last = c.messages[0];

      summaries.push({
        id: c.id,
        otherParticipant: {
          id: other.id,
          displayName: other.display_name?.trim() || `User ${other.id}`,
        },
        updatedAt: (last?.created_at ?? c.last_message_at ?? c.created_at).toISOString(),
        createdAt: c.created_at.toISOString(),
        lastMessage: last
          ? {
              id: last.id,
              text: last.content,
              createdAt: last.created_at.toISOString(),
              senderId: last.sender_id,
              senderName:
                last.users.display_name?.trim() || `User ${last.sender_id}`,
            }
          : null,
      });
    }

    summaries.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return summaries;
  }

  async getMessages(conversationId: string, currentUserId: string): Promise<ChatMessage[]> {
    const normalizedCurrentUserId = this.normalizeUserId(currentUserId, 'userId');
    const convo = await this.prisma.conversations.findUnique({
      where: { id: conversationId },
    });

    if (!convo) {
      throw new NotFoundException('Conversation not found.');
    }

    this.assertParticipant(convo.user1_id, convo.user2_id, normalizedCurrentUserId);

    const messages = await this.prisma.messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });

    return messages.map((message) => {
      const recipientId =
        message.sender_id === convo.user1_id ? convo.user2_id : convo.user1_id;
      return {
        id: message.id,
        conversationId: convo.id,
        senderId: message.sender_id,
        recipientId,
        text: message.content,
        createdAt: message.created_at.toISOString(),
      };
    });
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ): Promise<ChatMessage> {
    const normalizedSenderId = this.normalizeUserId(senderId, 'senderId');
    const normalizedText = text?.trim();

    if (!normalizedText) {
      throw new BadRequestException('Message text is required.');
    }

    const convo = await this.prisma.conversations.findUnique({
      where: { id: conversationId },
    });

    if (!convo) {
      throw new NotFoundException('Conversation not found.');
    }

    this.assertParticipant(convo.user1_id, convo.user2_id, normalizedSenderId);

    const recipientId =
      convo.user1_id === normalizedSenderId ? convo.user2_id : convo.user1_id;

    const [sender, recipient] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: normalizedSenderId },
        select: { id: true, display_name: true },
      }),
      this.prisma.users.findUnique({ where: { id: recipientId }, select: { id: true } }),
    ]);

    if (!sender || !recipient) {
      throw new BadRequestException('Sender or recipient not found.');
    }

    const now = new Date();
    const message = await this.prisma.messages.create({
      data: {
        conversation_id: conversationId,
        sender_id: normalizedSenderId,
        content: normalizedText,
      },
    });

    await this.prisma.conversations.update({
      where: { id: conversationId },
      data: { last_message_at: now },
    });

    const chatMessage: ChatMessage = {
      id: message.id,
      conversationId: convo.id,
      senderId: message.sender_id,
      recipientId,
      text: message.content,
      createdAt: message.created_at.toISOString(),
    };

    void this.notifications
      .notifyMessageReceived(
        recipientId,
        sender.display_name ?? '',
        normalizedText,
        {
          conversationId: convo.id,
          messageId: message.id,
          senderId: normalizedSenderId,
        },
      )
      .catch((err: unknown) =>
        this.logger.warn(`In-app notification for message failed: ${String(err)}`),
      );

    return chatMessage;
  }

  private normalizeUserId(value: string, fieldName: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
    return normalized;
  }

  private orderUserIds(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private assertParticipant(user1Id: string, user2Id: string, userId: string): void {
    if (user1Id !== userId && user2Id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }
  }
}
