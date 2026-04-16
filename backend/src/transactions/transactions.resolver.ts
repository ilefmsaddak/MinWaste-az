import { UseGuards } from '@nestjs/common';
import { Args, Field, Float, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { ProfileService } from '../profile/profile.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionHooks } from './transaction.hooks';
import { ItemService } from '../item/item.service';
// GraphQL ObjectTypes for Transaction responses
@ObjectType()
class UserResponse {
  @Field()
  id: string;

  @Field()
  display_name: string;
}

@ObjectType()
class ItemResponse {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field(() => Float, { nullable: true })
  price_amount?: number;

  @Field({ nullable: true })
  price_type?: string;

  @Field(() => UserResponse, { nullable: true })
  users?: UserResponse;
}

@ObjectType()
export class TransactionResponse {
  @Field()
  id: string;

  @Field()
  status: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => ItemResponse, { nullable: true })
  item?: ItemResponse;

  @Field(() => UserResponse, { nullable: true })
  owner?: UserResponse;

  @Field(() => UserResponse, { nullable: true })
  receiver?: UserResponse;

  @Field()
  created_at: string;

  @Field()
  updated_at: string;
}
@Resolver()
export class TransactionsResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly gamification: GamificationService,
    private readonly profileService: ProfileService,
    private readonly notifications: NotificationsService,
    private readonly transactionHooks: TransactionHooks,
    private readonly itemService: ItemService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => [TransactionResponse])
  async myTransactions(@CurrentUser() fbUser: any) {
    try {
      const dbUser = await this.usersService.upsertFromFirebase(fbUser);

      // Fetch all transactions where user is either owner or receiver
      const transactions = await this.prisma.transactions.findMany({
        where: {
          OR: [{ owner_id: dbUser.id }, { receiver_id: dbUser.id }],
        },
        include: {
          items: {
            select: {
              id: true,
              title: true,
              price_amount: true,
              price_type: true,
              users: {
                select: {
                  id: true,
                  display_name: true,
                },
              },
            },
          },
          users_transactions_owner_idTousers: {
            select: {
              id: true,
              display_name: true,
            },
          },
          users_transactions_receiver_idTousers: {
            select: {
              id: true,
              display_name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return transactions.map((tx) => ({
        id: tx.id,
        status: String(tx.status),
        quantity: tx.quantity,
        item: tx.items
          ? {
              id: tx.items.id,
              title: tx.items.title,
              price_amount:
                tx.items.price_amount != null
                  ? Number(tx.items.price_amount)
                  : null,
              price_type: tx.items.price_type ?? null,
              users: tx.items.users
                ? {
                    id: tx.items.users.id,
                    display_name: tx.items.users.display_name,
                  }
                : null,
            }
          : null,
        owner: tx.users_transactions_owner_idTousers
          ? {
              id: tx.users_transactions_owner_idTousers.id,
              display_name: tx.users_transactions_owner_idTousers.display_name,
            }
          : null,
        receiver: tx.users_transactions_receiver_idTousers
          ? {
              id: tx.users_transactions_receiver_idTousers.id,
              display_name: tx.users_transactions_receiver_idTousers.display_name,
            }
          : null,
        created_at: tx.created_at.toISOString(),
        updated_at: tx.updated_at.toISOString(),
      }));
    } catch (err: any) {
      console.error('Error loading myTransactions:', err);
      throw err;
    }
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async completeTransaction(
    @CurrentUser() fbUser: any,
    @Args('transactionId') transactionId: string,
  ): Promise<boolean> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const tx = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    
    // Only the RECEIVER can complete the transaction
    if (tx.receiver_id !== dbUser.id) {
      throw new ForbiddenException('Only the buyer/receiver can complete this transaction');
    }
    
    if (tx.status === 'COMPLETED') return true;
    if (tx.status === 'CANCELED' || tx.status === 'EXPIRED') {
      throw new BadRequestException('Transaction cannot be completed');
    }
    if (
      tx.status !== 'PENDING' &&
      tx.status !== 'CONFIRMED_BY_SENDER'
    ) {
      throw new BadRequestException('Transaction cannot be completed');
    }

    await this.prisma.transactions.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED', updated_at: new Date() },
    });

    // ✅ Recalculate item status (may change to RESERVED if all txns are COMPLETED)
    await this.itemService.recalculateAndUpdateItemStatus(tx.item_id);

    const full = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });
    if (!full) return true;

    // Wire transaction hooks to process gamification and ecology
    await this.transactionHooks.onTransactionFinalized(transactionId);

    const otherId =
      full.owner_id === dbUser.id ? full.receiver_id : full.owner_id;
    await this.notifications.notifyTransactionCompleted(
      otherId,
      'Transaction completed',
      `+${full.items?.price_type === 'FREE' ? 'points earned (donation)' : 'points earned (sale)'} — MinWaste`,
    );

    return true;
  }
  /**
   * Create a new reservation (PENDING transaction).
   * Validates item availability and creates transaction.
   */
  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => String)
  async createReservation(
    @CurrentUser() fbUser: any,
    @Args('itemId') itemId: string,
    @Args('quantity', { type: () => Int, defaultValue: 1 }) quantity: number,
  ): Promise<string> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);

    // Validate item exists and is available
    const item = await this.prisma.items.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.owner_id === dbUser.id) {
      throw new BadRequestException('Cannot reserve your own item');
    }

    // ✅ Check if item is expired
    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      throw new BadRequestException('Item has expired');
    }

    // ✅ Compute real status based on quantity and transactions
    const realStatus = await this.itemService.computeRealItemStatus(itemId, {
      status: item.status,
      quantity_available: item.quantity_available,
      quantity_total: item.quantity_total,
      expires_at: item.expires_at,
    });

    // Reject if item is not in a reservable state
    if (['EXPIRED', 'DRAFT', 'BLOCKED'].includes(realStatus)) {
      throw new BadRequestException(`Item is ${realStatus} and cannot be reserved`);
    }

    // ✅ Main validation: check quantity, not just status
    if (item.quantity_available < quantity) {
      throw new BadRequestException('Insufficient quantity available');
    }

    // Create reservation with 48h expiry
    const reservedUntil = new Date();
    reservedUntil.setHours(reservedUntil.getHours() + 48);

    let transaction;
    try {
      transaction = await this.prisma.transactions.create({
        data: {
          item_id: itemId,
          owner_id: item.owner_id,
          receiver_id: dbUser.id,
          quantity,
          status: 'PENDING',
          reserved_until: reservedUntil,
        } as any,
      });
    } catch (error: any) {
      // Handle unique constraint errors
      if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
        throw new BadRequestException('You already have a pending reservation for this item');
      }
      throw error;
    }

    // Calculate new available quantity
    const newAvailable = item.quantity_available - quantity;
    
    // ✅ Update item: decrement available, then recalculate status
    await this.prisma.items.update({
      where: { id: itemId },
      data: {
        quantity_available: newAvailable,
      },
    });

    // ✅ Recalculate status based on new quantity and transaction state
    await this.itemService.recalculateAndUpdateItemStatus(itemId);

    // Create event
    await this.prisma.events.create({
      data: {
        user_id: dbUser.id,
        type: 'RESERVED',
        meta: { itemId, transactionId: transaction.id },
      } as any,
    });

    // Notify owner
    const prefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: item.owner_id },
    });

    if (prefs?.notif_reservation_updates !== false) {
      await this.prisma.notifications.create({
        data: {
          receiver_id: item.owner_id,
          type: 'RESERVATION_CREATED',
          title: 'New Reservation',
          body: `Someone reserved your item: ${item.title}`,
          payload: { 
            page: 'transactions', 
            tab: 'received', 
            itemId, 
            transactionId: transaction.id 
          },
        } as any,
      });
    }

    return transaction.id;
  }

  /**
   * Cancel a reservation.
   * Can be done by RECEIVER (buyer) only while status is PENDING.
   * Only allowed if less than 24 hours have passed since creation.
   */
  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async cancelReservation(
    @CurrentUser() fbUser: any,
    @Args('transactionId') transactionId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<boolean> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);

    const tx = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    // Only the RECEIVER (buyer) can cancel
    if (tx.receiver_id !== dbUser.id) {
      throw new ForbiddenException('Only the buyer can cancel a reservation');
    }

    if (tx.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel completed transaction');
    }

    if (tx.status === 'CANCELED' || tx.status === 'EXPIRED') {
      return true; // Already canceled
    }

    // Enforce 24-hour cancellation window (only for PENDING)
    if (tx.status === 'PENDING') {
      const createdAt = new Date(tx.created_at);
      const now = new Date();
      const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursElapsed > 24) {
        throw new BadRequestException(
          'Cancellation window has expired. You can only cancel within 24 hours of reservation.'
        );
      }
    }

    // Update transaction
    await this.prisma.transactions.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELED',
        canceled_reason: reason ?? 'Canceled by user',
        updated_at: new Date(),
      },
    });

    // Restore item availability
    await this.prisma.items.update({
      where: { id: tx.item_id },
      data: {
        quantity_available: { increment: tx.quantity },
      },
    });

    // ✅ Recalculate status based on new quantity and remaining transactions
    await this.itemService.recalculateAndUpdateItemStatus(tx.item_id);

    // Create event
    await this.prisma.events.create({
      data: {
        user_id: dbUser.id,
        type: 'CANCELED',
        meta: { itemId: tx.item_id, transactionId: tx.id, reason },
      } as any,
    });

    // Notify the other party
    const otherId = tx.owner_id === dbUser.id ? tx.receiver_id : tx.owner_id;
    const prefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: otherId },
    });

    if (prefs?.notif_reservation_updates !== false) {
      await this.prisma.notifications.create({
        data: {
          receiver_id: otherId,
          type: 'RESERVATION_CANCELED',
          title: 'Reservation Canceled',
          body: `A reservation for "${tx.items?.title}" has been canceled`,
          payload: { itemId: tx.item_id, transactionId: tx.id },
        } as any,
      });
    }

    return true;
  }


  /**
   * Free donation: the donor confirms pickup (PENDING → CONFIRMED_BY_SENDER).
   * Awards +10 pts (CONFIRM_DONATION), once per transaction.
   */
  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async confirmDonationTransaction(
    @CurrentUser() fbUser: any,
    @Args('transactionId') transactionId: string,
  ): Promise<boolean> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const tx = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.owner_id !== dbUser.id) {
      throw new ForbiddenException('Only the donor/seller can confirm');
    }
    if (!tx.items || tx.items.price_type !== 'FREE') {
      throw new BadRequestException('This mutation is reserved for free donations only');
    }
    if (tx.status !== 'PENDING') {
      throw new BadRequestException('Confirmation already done or invalid status');
    }

    await this.prisma.transactions.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED_BY_SENDER', updated_at: new Date() },
    });

    await this.gamification.awardConfirmDonation(tx.owner_id, tx.id);
    await this.profileService.ensureBadgesForUser(tx.owner_id);

    // Notify buyer that donation is confirmed
    const item = tx.items;
    const buyerPrefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: tx.receiver_id },
    });

    if (buyerPrefs?.notif_reservation_updates !== false) {
      await this.prisma.notifications.create({
        data: {
          receiver_id: tx.receiver_id,
          type: 'RESERVATION_CONFIRMED',
          title: 'Donation Confirmed',
          body: `Your reservation for "${item?.title}" has been confirmed by the donor.`,
          payload: { 
            page: 'transactions', 
            tab: 'purchases', 
            itemId: tx.item_id, 
            transactionId: tx.id 
          },
        } as any,
      });
    }

    return true;
  }

  /**
   * Sale confirmation: the seller confirms a PAID item reservation (PENDING → CONFIRMED_BY_SENDER).
   * Awards +10 pts (CONFIRM_SALE), once per transaction.
   */
  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async confirmSaleTransaction(
    @CurrentUser() fbUser: any,
    @Args('transactionId') transactionId: string,
  ): Promise<boolean> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const tx = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.owner_id !== dbUser.id) {
      throw new ForbiddenException('Only the seller can confirm');
    }
    if (!tx.items || tx.items.price_type === 'FREE') {
      throw new BadRequestException('This mutation is reserved for paid sales only');
    }
    if (tx.status !== 'PENDING') {
      throw new BadRequestException('Confirmation already done or invalid status');
    }

    await this.prisma.transactions.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED_BY_SENDER', updated_at: new Date() },
    });

    // Notify buyer that sale is confirmed
    const item = tx.items;
    const buyerPrefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: tx.receiver_id },
    });

    if (buyerPrefs?.notif_reservation_updates !== false) {
      await this.prisma.notifications.create({
        data: {
          receiver_id: tx.receiver_id,
          type: 'RESERVATION_CONFIRMED',
          title: 'Sale Confirmed',
          body: `Your reservation for "${item?.title}" has been confirmed by the seller. Complete your purchase to finalize the transaction.`,
          payload: { 
            page: 'transactions', 
            tab: 'purchases', 
            itemId: tx.item_id, 
            transactionId: tx.id 
          },
        } as any,
      });
    }

    return true;
  }
}
