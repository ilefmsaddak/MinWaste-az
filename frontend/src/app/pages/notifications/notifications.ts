import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo, gql } from 'apollo-angular';
import { HttpHeaders } from '@angular/common/http';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { Router } from '@angular/router';
import { useMockDashboardNotifications } from '../../core/mock/mock-data.config';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { TimeoutError, firstValueFrom } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';
import {
  createMockNotifications,
  type MockNotification,
} from '../../core/mock/notifications-mock.data';

function formatNotificationsError(e: unknown): string {
  if (!e) return 'Erreur inconnue';
  if (e instanceof TimeoutError) {
    return 'Timeout: le serveur ne repond pas. Verifiez que le backend tourne sur http://localhost:4000.';
  }
  const anyE = e as {
    message?: string;
    graphQLErrors?: { message?: string }[];
    networkError?: { message?: string };
  };

  const gqlMsgs = anyE.graphQLErrors?.map((x) => x?.message).filter(Boolean);
  if (gqlMsgs?.length) return gqlMsgs.join(' · ');
  if (anyE.networkError?.message) return anyE.networkError.message;
  if (typeof anyE.message === 'string') return anyE.message;
  return 'Impossible de charger les notifications.';
}

const LIST = gql`
  query MyNotifications {
    myNotifications {
      id
      type
      title
      body
      isRead
      payload
      createdAt
    }
  }
`;

const MARK_READ = gql`
  mutation MarkNotificationRead($id: String!) {
    markNotificationRead(id: $id)
  }
`;

const MARK_ALL = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotificationsPage implements OnInit {
  loading = true;
  error: string | null = null;
  items: MockNotification[] = [];
  /** Données locales (mock) — pas d’appel GraphQL */
  isMockMode = false;

  constructor(
    private readonly apollo: Apollo,
    private readonly auth: FirebaseAuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.isMockMode = useMockDashboardNotifications();

    if (this.isMockMode) {
      this.items = createMockNotifications();
      this.loading = false;
      this.error = null;
      return;
    }

    void this.loadFromApi();
  }

  private async ensureToken(): Promise<string | null> {
    await firstValueFrom(
      this.auth.authReady$.pipe(filter(Boolean), take(1), timeout(6000)),
    );

    // Petit delai pour laisser Firebase finir la restauration de session au 1er clic.
    await new Promise((resolve) => setTimeout(resolve, 80));
    return this.auth.getIdToken();
  }

  private async loadFromApi(): Promise<void> {
    let token: string | null = null;
    try {
      token = await this.ensureToken();
    } catch {
      this.loading = false;
      this.items = [];
      this.error =
        'Session non prete. Reessayez dans quelques secondes ou reconnectez-vous.';
      this.cdr.markForCheck();
      return;
    }

    if (!token) {
      this.loading = false;
      this.items = [];
      this.error = 'Token d\'authentification introuvable. Veuillez vous reconnecter.';
      this.cdr.markForCheck();
      return;
    }

    try {
      let response: any = await firstValueFrom(
        this.apollo
          .query({
            query: LIST,
            fetchPolicy: 'network-only',
            errorPolicy: 'all',
            context: {
              headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            },
          })
          .pipe(timeout(15000)),
      );

      const firstErrors = response?.errors;
      const shouldRetry =
        Array.isArray(firstErrors) &&
        firstErrors.some((x: { message?: string }) =>
          /unauthorized|forbidden|auth|token/i.test(String(x?.message ?? '')),
        );

      if (shouldRetry) {
        const freshToken = await this.auth.getValidIdToken();
        response = await firstValueFrom(
          this.apollo
            .query({
              query: LIST,
              fetchPolicy: 'network-only',
              errorPolicy: 'all',
              context: {
                headers: new HttpHeaders({ Authorization: `Bearer ${freshToken}` }),
              },
            })
            .pipe(timeout(15000)),
        );
      }

      if (response?.errors?.length) {
        this.error = response.errors
          .map((x: { message?: string }) => x?.message)
          .filter(Boolean)
          .join(' · ');
        this.items = [];
        this.cdr.markForCheck();
        return;
      }

      this.items = response?.data?.myNotifications ?? [];
      this.error = null;
      this.cdr.markForCheck();
    } catch (e: unknown) {
      this.error = formatNotificationsError(e);
      this.items = [];
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  markRead(id: string, options?: { reload?: boolean }): void {
    const reload = options?.reload !== false;
    if (this.isMockMode) {
      this.items = this.items.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      return;
    }
    this.apollo
      .mutate({ mutation: MARK_READ, variables: { id } })
      .subscribe({
        next: () => {
          if (reload) this.load();
        },
        error: () => {},
      });
  }

  /** Mark as read; handle redirection based on payload kind/page. */
  onNotifClick(n: MockNotification): void {
    // 1. Mark as read first (without full reload to maintain navigation speed)
    this.markRead(n.id, { reload: false });

    // 2. Extract payload if present
    let payload: any = null;
    if (n.payload) {
      try {
        payload = JSON.parse(n.payload);
      } catch (e) {
        console.warn('Failed to parse notification payload:', n.payload);
      }
    }

    // 3. Priority 1: Navigation explicitly defined in payload
    if (payload?.page) {
      const navExtras = payload.tab ? { queryParams: { tab: payload.tab } } : {};
      void this.router.navigate([`/${payload.page}`], navExtras);
      return;
    }

    // 4. Priority 2: Type-based fallback (for old notifications or simple ones)
    switch (n.type) {
      case 'MESSAGE_RECEIVED':
        void this.router.navigate(['/messages']);
        break;
      
      case 'RESERVATION_CREATED':
        // Fallback for old reservations
        void this.router.navigate(['/transactions'], { queryParams: { tab: 'received' } });
        break;
      
      case 'RESERVATION_CONFIRMED':
      case 'PICKUP_CONFIRMED':
        // Confirmation notifications should lead to purchases (or received if seller, 
        // but typically the receiver gets these alerts)
        void this.router.navigate(['/transactions'], { queryParams: { tab: 'purchases' } });
        break;
      
      case 'BADGE_EARNED':
        // Badges are displayed on the profile page
        void this.router.navigate(['/profile']);
        break;
      
      case 'ITEM_EXPIRED':
        // Lead to own item history
        void this.router.navigate(['/announce-history']);
        break;

      case 'RESERVATION_CANCELED':
        // Lead to general transactions view
        void this.router.navigate(['/transactions']);
        break;

      default:
        // Default safe behavior: stay here or go to safe home page if unknown
        console.log('Notification type has no specific route:', n.type);
        break;
    }
  }

  /** Affichage lisible : BADGE_EARNED → « BADGE EARNED » */
  formatNotifType(t: string): string {
    return String(t ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  markAll(): void {
    if (this.isMockMode) {
      this.items = this.items.map((n) => ({ ...n, isRead: true }));
      return;
    }
    this.apollo.mutate({ mutation: MARK_ALL }).subscribe({
      next: () => this.load(),
      error: () => {},
    });
  }
}
