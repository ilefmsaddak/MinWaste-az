import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { MessageSocketService } from '../../services/message-socket.service';

@Component({
  selector: 'app-admin-nav-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './admin-nav-bar.html',
  styleUrl: './admin-nav-bar.scss',
})
export class AdminNavBar {
  userMenuOpen = signal(false);
  sidebarOpen = signal(false);

  adminNavItems = [
    { label: 'Dashboard', route: '/admin', icon: '📊' },
    { label: 'Users', route: '/admin/users', icon: '👥' },
    { label: 'Announcements', route: '/admin/announcements', icon: '📢' },
    { label: 'Gamification', route: '/admin/gamification', icon: '🎮' },
    { label: 'Ecology', route: '/admin/ecology', icon: '🌍' }
  ];

  constructor(
    private readonly router: Router,
    private readonly auth: FirebaseAuthService,
    private readonly messageSocket: MessageSocketService,
  ) {}

  toggleUserMenu() {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  toggleSidebar() {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  backToApp(): void {
    void this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    this.userMenuOpen.set(false);
    this.messageSocket.disconnect();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
