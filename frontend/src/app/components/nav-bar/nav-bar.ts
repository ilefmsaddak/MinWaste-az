import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { UserRoleService } from '../../core/auth/user-role.service';
import { MessageSocketService } from '../../services/message-socket.service';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit {
  userMenuOpen = signal(false);
  private readonly messageSocket = inject(MessageSocketService);
  private readonly userRole = inject(UserRoleService);
  readonly unreadMessagesCount = this.messageSocket.unreadMessagesCount;
  readonly isAdmin = this.userRole.isAdmin;

  constructor(
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.messageSocket.ensureSocketConnected();
    void this.userRole.refresh();
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
