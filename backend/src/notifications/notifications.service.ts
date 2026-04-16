import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, take = 50) {
    return this.prisma.notifications.findMany({
      where: { receiver_id: userId } as any,
      orderBy: { created_at: 'desc' } as any,
      take,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notifications.count({
      where: { receiver_id: userId, is_read: false } as any,
    });
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const n = await this.prisma.notifications.updateMany({
      where: { id, receiver_id: userId } as any,
      data: { is_read: true },
    });
    return n.count > 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notifications.updateMany({
      where: { receiver_id: userId, is_read: false } as any,
      data: { is_read: true },
    });
  }

  async notifyTransactionCompleted(
    receiverId: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this.prisma.notifications.create({
      data: {
        receiver_id: receiverId,
        type: 'PICKUP_CONFIRMED',
        title,
        body,
        payload: { 
          kind: 'TRANSACTION_COMPLETED',
          page: 'transactions',
          tab: 'purchases'
        } as any,
      } as any,
    });
  }

  async notifyMessageReceived(
    recipientId: string,
    senderDisplayName: string,
    textPreview: string,
    payload: { conversationId: string; messageId: string; senderId: string },
  ): Promise<void> {
    const prefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: recipientId },
    });
    if (prefs?.notif_inapp_enabled === false) return;
    if (prefs?.notif_messages === false) return;

    const preview = textPreview?.trim() ?? '';
    const truncated =
      preview.length > 160 ? `${preview.slice(0, 157)}…` : preview;
    const name = senderDisplayName?.trim() || 'Someone';

    await this.prisma.notifications.create({
      data: {
        receiver_id: recipientId,
        type: 'MESSAGE_RECEIVED',
        title: 'New message',
        body: truncated ? `${name}: ${truncated}` : `Message from ${name}`,
        payload: payload as any,
      } as any,
    });
  }

  async notifyBadgeEarned(
    userId: string,
    badgeName: string,
    badgeCode: string,
  ): Promise<void> {
    const prefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });
    if (prefs && prefs.notif_badges === false) return;

    await this.prisma.notifications.create({
      data: {
        receiver_id: userId,
        type: 'BADGE_EARNED',
        title: '🏅 New badge',
        body: `You unlocked: ${badgeName}`,
        payload: { 
          kind: 'BADGE_EARNED', 
          code: badgeCode,
          page: 'profile'
        } as any,
      } as any,
    });
  }
}
