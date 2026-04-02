import { Module } from '@nestjs/common';
import { AzureStorageService } from './azure-storage.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [AzureStorageService],
  exports: [AzureStorageService],
})
export class StorageModule {}
