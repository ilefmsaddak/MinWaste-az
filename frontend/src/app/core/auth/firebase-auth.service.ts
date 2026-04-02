import { Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { getResolvedFirebaseWebAppConfig } from './firebase-web.config';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly app: FirebaseApp | null;
  private readonly auth: Auth | null;

  public user$: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(
    null,
  );

  public authReady$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );

  constructor() {
    const cfg = getResolvedFirebaseWebAppConfig();
    if (!cfg.apiKey?.trim()) {
      console.error(
        '[Firebase] Config Web absente : ajoutez dans backend/secrets/firebase.json un objet "web" { apiKey, appId, messagingSenderId } pour le projet minwaste-app (même projet que le compte de service). Redémarrez le backend puis rechargez l’app.',
      );
      this.app = null;
      this.auth = null;
      if (!this.authReady$.value) this.authReady$.next(true);
      return;
    }
    if (cfg.projectId !== 'minwaste-app') {
      console.warn(
        `[Firebase] projectId="${cfg.projectId}" — le backend attend des tokens minwaste-app (FIREBASE_PROJECT_ID).`,
      );
    }
    try {
      const options: FirebaseOptions = {
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      };
      if (cfg.measurementId?.trim()) {
        options.measurementId = cfg.measurementId.trim();
      }
      this.app = initializeApp(options);
      this.auth = getAuth(this.app);
      onAuthStateChanged(this.auth, (user: User | null) => {
        this.user$.next(user);
        if (!this.authReady$.value) this.authReady$.next(true);
      });
    } catch (e: unknown) {
      console.error('[Firebase] initializeApp a échoué', e);
      this.app = null;
      this.auth = null;
      if (!this.authReady$.value) this.authReady$.next(true);
    }
  }

  private requireAuth(): Auth {
    if (!this.auth) {
      throw new Error(
        'Firebase non configuré : complétez secrets/firebase.json → web (minwaste-app), redémarrez le backend, rechargez.',
      );
    }
    return this.auth;
  }

  getCurrentUser(): User | null {
    return this.auth?.currentUser ?? null;
  }

  // 🔹 Enregistrement
  async register(email: string, password: string, displayName?: string) {
    try {
      // Validation basique
      if (!email || !password) {
        throw new Error('Email et mot de passe requis');
      }
      
      if (password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      }

      const auth = this.requireAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const name = displayName?.trim();
      // Only update Firebase if displayName is non-empty string
      if (name && typeof name === 'string' && name.length > 0) {
        try {
          await updateProfile(cred.user, { displayName: name });
          console.log('[FirebaseAuthService] ✅ Firebase displayName set during registration:', name);
        } catch (err: any) {
          // Log Firebase sync error but don't fail registration
          console.warn('[FirebaseAuthService] ⚠️ Failed to set displayName during registration:', err?.message);
        }
      }

      // Ne pas bloquer l’inscription si l’email de vérif. met du temps ou échoue (réseau / SMTP).
      void sendEmailVerification(cred.user).catch((err) =>
        console.warn('sendEmailVerification:', err),
      );
      return cred.user;
    } catch (error: any) {
      console.error('Firebase registration error:', error);
      
      // Gestion spécifique des erreurs Firebase
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already in use. Please log in.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Minimum 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Format d\'email invalide.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Check your connection.');
      } else if (error.code === 'auth/api-key-not-valid') {
        throw new Error('Invalid Firebase configuration. Check the API key.');
      } else {
        throw new Error(`Registration error: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // 🔹 Connexion email/mot de passe
  async login(email: string, password: string) {
    const auth = this.requireAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Eagerly update the stream so route guards/components see the user immediately.
    this.user$.next(cred.user);
    return cred;
  }

  // 🔹 Connexion Google
  async loginWithGoogle() {
    const auth = this.requireAuth();
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    this.user$.next(cred.user);
    return cred;
  }

  // 🔹 Réinitialisation mot de passe
  forgotPassword(email: string) {
    return sendPasswordResetEmail(this.requireAuth(), email);
  }

  // 🔹 Déconnexion
  async logout() {
    if (this.auth) await signOut(this.auth);
    this.user$.next(null);
    try {
      localStorage.removeItem('userId');
    } catch {
      /* ignore */
    }
  }

  // 🔹 Récupérer ID token actuel (rafraîchi automatiquement)
  async getIdToken(): Promise<string | null> {
    if (!this.auth) return null;
    const user = this.auth.currentUser ?? this.user$.value;
    return user ? user.getIdToken() : null;
  }

  // 🔹 Récupérer ID token forcé
  async getValidIdToken(): Promise<string> {
    const auth = this.requireAuth();
    const user = auth.currentUser ?? this.user$.value;
    if (!user) throw new Error('No user logged in');
    return await user.getIdToken(true);
  }

  // 🔹 Get user info + token for DB
  async getUserInfoForDB() {
    const user = this.getCurrentUser() ?? this.user$.value;
    if (!user) throw new Error('No user logged in');
    const token = await this.getValidIdToken();
    return { uid: user.uid, email: user.email, token };
  }

  async changeEmail(newEmail: string) {
    const email = newEmail.trim();
    if (!email) throw new Error('Email is required');
    const auth = this.requireAuth();
    const user = auth.currentUser ?? this.user$.value;
    if (!user) throw new Error('No user logged in');
    await updateEmail(user, email);
    this.user$.next(user);
    return user;
  }

  async changePassword(newPassword: string) {
    const pwd = newPassword;
    if (!pwd || pwd.length < 6) throw new Error('Password must be at least 6 characters');
    const auth = this.requireAuth();
    const user = auth.currentUser ?? this.user$.value;
    if (!user) throw new Error('No user logged in');
    await updatePassword(user, pwd);
    return true;
  }

  async sendPasswordResetForCurrentUser() {
    const auth = this.requireAuth();
    const user = auth.currentUser ?? this.user$.value;
    const email = user?.email;
    if (!email) throw new Error('No email found for current user');
    await sendPasswordResetEmail(auth, email);
    return true;
  }

  /**
   * ✅ Synchronize displayName to Firebase profile
   * Firebase Profile only accepts: displayName, photoURL
   * Phone, bio, city, governorate, avatarUrl are stored in PostgreSQL only
   * 
   * DEFENSIVE: Won't call Firebase updateProfile() if:
   * - displayName is null, undefined, or empty string
   * - displayName is not a string type
   * - displayName exceeds 256 characters
   */
  async updateFirebaseDisplayName(displayName: unknown): Promise<void> {
    if (!this.auth) return;
    const user = this.auth.currentUser ?? this.user$.value;
    if (!user) {
      console.warn('[FirebaseAuthService] ⚠️ updateFirebaseDisplayName: No user logged in');
      return;
    }

    // Defensive: Only allow non-empty strings
    if (typeof displayName !== 'string') {
      console.log('[FirebaseAuthService] ⚠️ Skipping Firebase sync: displayName is not a string');
      return;
    }

    const trimmed = displayName.trim();
    if (trimmed === '') {
      console.log('[FirebaseAuthService] ⚠️ Skipping Firebase sync: displayName is empty');
      return;
    }

    // Limit length to prevent Firebase validation errors
    const safeName = trimmed.substring(0, 256);

    try {
      await updateProfile(user, { displayName: safeName });
      console.log('[FirebaseAuthService] ✅ Firebase displayName synced:', safeName);
    } catch (error: any) {
      // Log but don't throw - Firebase sync failure shouldn't block DB save
      const code = error?.code ?? '';
      const msg = error?.message ?? 'Unknown error';
      console.warn(`[FirebaseAuthService] ⚠️ Failed to sync displayName (${code}): ${msg}`);
    }
  }
}