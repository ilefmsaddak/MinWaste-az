import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ProfileModule } from '../profile/profile.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EcologyModule } from '../ecology/ecology.module';
import { ItemModule } from '../item/item.module';
import { TransactionsResolver } from './transactions.resolver';
import { TransactionHooks } from './transaction.hooks';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    GamificationModule,
    ProfileModule,
    NotificationsModule,
    EcologyModule,
    ItemModule,
  ],
  providers: [TransactionsResolver, TransactionHooks],
})
export class TransactionsModule {}
