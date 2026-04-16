import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { UserRoleService } from '../../core/auth/user-role.service';
import { MessageSocketService } from '../../services/message-socket.service';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit, OnDestroy {
  userMenuOpen = signal(false);
  private readonly messageSocket = inject(MessageSocketService);
  private readonly userRole = inject(UserRoleService);
  readonly unreadMessagesCount = this.messageSocket.unreadMessagesCount;
  readonly unreadNotificationsCount = signal(0);
  readonly isAdmin = this.userRole.isAdmin;
  private refreshInterval: any;

  constructor(
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
    private readonly apollo: Apollo,
  ) {}

  ngOnInit(): void {
    this.messageSocket.ensureSocketConnected();
    void this.userRole.refresh();
    void this.refreshNotificationCount();

    // Poll every 30s for minimal robust updates as requested
    this.refreshInterval = setInterval(() => {
      void this.refreshNotificationCount();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async refreshNotificationCount() {
    try {
      const token = await this.auth.getValidIdToken();
      if (!token) return;

      const UNREAD_COUNT_QUERY = gql`
        query UnreadNotificationsCount {
          unreadNotificationsCount
        }
      `;

      const result = await firstValueFrom(
        this.apollo.query<{ unreadNotificationsCount: number }>({
          query: UNREAD_COUNT_QUERY,
          fetchPolicy: 'network-only',
          context: {
            headers: { Authorization: `Bearer ${token}` } as any,
          },
        })
      );

      if (result.data) {
        this.unreadNotificationsCount.set(result.data.unreadNotificationsCount);
      }
    } catch (err) {
      console.error('Error refreshing notification count:', err);
    }
  }

  readonly navItems = computed(() => {
    const items = [
      { label: 'Home', route: '/', icon: 'home' },
      { label: 'Buy', route: '/buy', icon: 'buy' },
      { label: 'Mes annonces', route: '/announce-history', icon: 'list' },
      { label: 'Map', route: '/map', icon: 'map' },
      { label: 'Sell', route: '/create-announce', icon: 'add' },
      { label: 'Messages', route: '/messages', icon: 'message' },
      { label: 'Notifs', route: '/notifications', icon: 'bell' },
    ];
    if (this.userRole.isAdmin()) {
      items.push({ label: 'Admin', route: '/admin', icon: 'chart' });
    }
    return items;
  });

  toggleUserMenu() {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  async logout(): Promise<void> {
    this.userMenuOpen.set(false);
    this.messageSocket.disconnect();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  getIcon(iconName: string): string {
    const icons: { [key: string]: string } = {
      home: '🏠',
      buy: '🛒',
      list: '📋',
      map: '🗺️',
      add: '➕',
      message: '💬',
      chart: '📊',
      bell: '🔔',
      profile: '👤',
      settings: '⚙️',
      logout: '🚪'
    };
    return icons[iconName] || '•';
  }
}
