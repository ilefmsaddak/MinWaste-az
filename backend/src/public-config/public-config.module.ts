import { Module } from '@nestjs/common';
import { FirebaseWebPublicController } from './firebase-web-public.controller';

@Module({
  controllers: [FirebaseWebPublicController],
})
export class PublicConfigModule {}
