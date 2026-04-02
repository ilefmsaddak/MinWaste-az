import { Module } from '@nestjs/common';
import { AnnonceService } from './annonce.service';
import { AnnonceResolver } from './annonce.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AnnonceResolver, AnnonceService],
})
export class AnnonceModule {}
