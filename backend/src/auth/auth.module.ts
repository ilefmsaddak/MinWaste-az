import { Module } from '@nestjs/common';
import { firebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseAuthRestGuard } from './guards/firebase-auth-rest.guard';

@Module({
  providers: [firebaseAdminProvider, FirebaseAuthService, FirebaseAuthRestGuard],
  exports: [FirebaseAuthService, FirebaseAuthRestGuard],
})
export class AuthModule {}
