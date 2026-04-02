import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsResolver } from './recommendations.resolver';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, StorageModule],
  providers: [RecommendationsService, RecommendationsResolver],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
