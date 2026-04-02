import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, GamificationModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardResolver],
})
export class DashboardModule {}
