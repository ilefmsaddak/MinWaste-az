import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { StorageModule } from './storage/storage.module';
import { ItemModule } from './item/item.module';
import { AiModule } from './ai/ai.module';
import { AnnonceModule } from './annonce/annonce.module';
import { GamificationModule } from './gamification/gamification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { EcologyModule } from './ecology/ecology.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { PublicConfigModule } from './public-config/public-config.module';

@Module({
  imports: [
    PublicConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    GamificationModule,
    DashboardModule,
    NotificationsModule,
    TransactionsModule,
    RecommendationsModule,
    EcologyModule,
    StorageModule,
    ItemModule,
    AiModule,
    AnnonceModule,
    ChatModule,
    AdminModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      context: ({ req }) => ({ req }),
    }),
  ],
})
export class AppModule {}
