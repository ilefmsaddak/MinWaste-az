import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { PasswordHashService } from './password.hash.service';
import { AuthModule } from '../auth/auth.module'; // <-- IMPORTER AuthModule

@Module({
  imports: [AuthModule], // <-- Ajouté
  providers: [UsersService, UsersResolver, PasswordHashService],
  exports: [UsersService, PasswordHashService],
})
export class UsersModule {}
