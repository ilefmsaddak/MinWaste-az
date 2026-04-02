import { Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';
import { MessageSocketService } from '../../../services/message-socket.service';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';

const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      displayName
    }
  }
`;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginPage {
  email = '';
  password = '';
  loading = false;
  error: string | null = null;

  constructor(
    private auth: FirebaseAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private apollo: Apollo,
    private ngZone: NgZone,
    private readonly messageSocket: MessageSocketService,
  ) {}

  /** After login, honor `?returnUrl=/admin` from route guards (safe internal paths only). */
  private postLoginUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl')?.trim() ?? '';
    if (
      raw.startsWith('/') &&
      !raw.startsWith('//') &&
      !raw.includes('://')
    ) {
      return raw;
    }
    return '/profile';
  }

  async submit() {
    this.loading = true;
    this.error = null;
    try {
      const email = this.email.trim();
      const password = this.password.trim();

      console.log('Submitting login with:', { email, password: '***' });

      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      await this.auth.login(email, password);

      this.ngZone.run(() =>
        this.router.navigateByUrl(this.postLoginUrl(), { replaceUrl: true }),
      );

      void (async () => {
        try {
          const userInfo = await this.auth.getUserInfoForDB();
          const res = await firstValueFrom(
            this.apollo.query({
              query: ME_QUERY,
              fetchPolicy: 'no-cache',
              context: {
                headers: {
                  Authorization: `Bearer ${userInfo.token}`,
                } as any,
              },
            }),
          );
          const dbId = (res.data as { me?: { id?: string } })?.me?.id;
          if (dbId) {
            localStorage.setItem('userId', dbId);
            this.messageSocket.ensureSocketConnected();
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Backend user upsert failed (non-blocking):', e);
        }
      })();
   } catch (e: any) {
  console.log('FIREBASE ERROR FULL:', e);
  console.log('code:', e?.code);
  console.log('message:', e?.message);
  console.log('customData:', e?.customData);
  this.error = `${e?.code ?? ''} - ${e?.message ?? 'Firebase error'}`;
} finally {
      this.loading = false;
    }
  }

  async google() {
    this.loading = true;
    this.error = null;
    try {
      await this.auth.loginWithGoogle();

      this.ngZone.run(() =>
        this.router.navigateByUrl(this.postLoginUrl(), { replaceUrl: true }),
      );

      void (async () => {
        try {
          const userInfo = await this.auth.getUserInfoForDB();
          const res = await firstValueFrom(
            this.apollo.query({
              query: ME_QUERY,
              fetchPolicy: 'no-cache',
              context: {
                headers: {
                  Authorization: `Bearer ${userInfo.token}`,
                } as any,
              },
            }),
          );
          const dbId = (res.data as { me?: { id?: string } })?.me?.id;
          if (dbId) {
            localStorage.setItem('userId', dbId);
            this.messageSocket.ensureSocketConnected();
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Backend user upsert failed (non-blocking):', e);
        }
      })();
    } catch (e: any) {
  console.log('FIREBASE ERROR FULL:', e);
  console.log('code:', e?.code);
  console.log('message:', e?.message);
  console.log('customData:', e?.customData);
  this.error = `${e?.code ?? ''} - ${e?.message ?? 'Firebase error'}`;
} finally {
      this.loading = false;
    }
  }
}