import { Module } from '@nestjs/common';
import { EcologyService } from './ecology.service';
import { EcologyResolver } from './ecology.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule],
  providers: [EcologyService, EcologyResolver],
  exports: [EcologyService],
})
export class EcologyModule {}