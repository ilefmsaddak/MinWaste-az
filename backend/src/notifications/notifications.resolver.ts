import { UseGuards } from '@nestjs/common';
import { Args, Field, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';

@ObjectType()
export class NotificationGql {
  @Field() id: string;
  @Field() type: string;
  @Field({ nullable: true }) title?: string;
  @Field() body: string;
  @Field() isRead: boolean;
  @Field({ nullable: true }) payload?: string;
  @Field(() => Date) createdAt: Date;
}

@Resolver()
export class NotificationsResolver {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => [NotificationGql])
  async myNotifications(@CurrentUser() fbUser: any): Promise<NotificationGql[]> {
    const user = await this.usersService.upsertFromFirebase(fbUser);
    const rows = await this.notifications.listForUser(user.id);
    return rows.map((n: any) => ({
      id: n.id,
      type: String(n.type),
      title: n.title ?? undefined,
      body: n.body,
      isRead: n.is_read,
      payload: n.payload ? JSON.stringify(n.payload) : undefined,
      createdAt: n.created_at,
    }));
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => Int)
  async unreadNotificationsCount(@CurrentUser() fbUser: any): Promise<number> {
    const user = await this.usersService.upsertFromFirebase(fbUser);
    return this.notifications.unreadCount(user.id);
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async markNotificationRead(
    @CurrentUser() fbUser: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    const user = await this.usersService.upsertFromFirebase(fbUser);
    return this.notifications.markRead(user.id, id);
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async markAllNotificationsRead(@CurrentUser() fbUser: any): Promise<boolean> {
    const user = await this.usersService.upsertFromFirebase(fbUser);
    await this.notifications.markAllRead(user.id);
    return true;
  }
}
