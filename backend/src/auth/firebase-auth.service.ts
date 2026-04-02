import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { app } from 'firebase-admin';
import { FIREBASE_ADMIN } from './firebase-admin.provider';

@Injectable()
export class FirebaseAuthService {
  constructor(@Inject(FIREBASE_ADMIN) private readonly firebaseApp: app.App) {}

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        ),
      ),
    ]);
  }

  async verifyIdToken(idToken: string) {
    try {
      // If the environment can't reach Google endpoints (certs), verifyIdToken can be very slow.
      // Fail fast so the frontend doesn't get stuck in a perpetual loading state.
      return await this.withTimeout(
        this.firebaseApp.auth().verifyIdToken(idToken),
        8000,
        'Firebase token verification',
      );
    } catch (e: any) {
      const code = e?.code ?? e?.errorInfo?.code;
      console.warn(
        '[FirebaseAuthService] verifyIdToken failed:',
        code ?? e?.message ?? e,
      );
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}
