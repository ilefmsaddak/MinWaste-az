import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ItemModule } from '../item/item.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AdminRoleRestGuard } from '../auth/guards/admin-role-rest.guard';
import { AdminUsersController } from './admin-users.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AdminBadgesController } from './admin-badges.controller';
import { AdminLeaderboardController } from './admin-leaderboard.controller';

@Module({
  imports: [PrismaModule, ItemModule, AuthModule, UsersModule],
  controllers: [
    AdminUsersController,
    AdminAnnouncementsController,
    AdminBadgesController,
    AdminLeaderboardController,
  ],
  providers: [AdminRoleRestGuard],
})
export class AdminModule {}
