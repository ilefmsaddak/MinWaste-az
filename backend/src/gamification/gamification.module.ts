import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GamificationService } from './gamification.service';
import { GamificationResolver } from './gamification.resolver';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  providers: [GamificationService, GamificationResolver, FirebaseGqlGuard],
  exports: [GamificationService],
})
export class GamificationModule {}
