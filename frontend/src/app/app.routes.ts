import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';
import { AdminGuard } from './core/auth/admin.guard';
import { GuestGuard } from './core/auth/guest.guard';
import { CreateAnnouncePage } from './pages/create-announce/create-announce';
import { AnnounceHistoryPage } from './pages/announce-history/announce-history';
import { Acceuil } from './pages/acceuil/acceuil';
import { Buy } from './pages/buy/buy';
import { MapPage } from './pages/map/map';
import { AnnonceDetail } from './pages/annonce-detail/annonce-detail';
import { MessagesPage } from './pages/messages/messages';
import { DashboardPage } from './pages/dashboard/dashboard';
import { NotificationsPage } from './pages/notifications/notifications';
import { TransactionsPage } from './pages/transactions/transactions';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { AdminUsers } from './pages/admin-users/admin-users';
import { AdminAnnouncements } from './pages/admin-announcements/admin-announcements';
import { AdminGamification } from './pages/admin-gamification/admin-gamification';
import { AdminEcology } from './pages/admin-ecology/admin-ecology';

export const routes: Routes = [
  { path: '', canActivate: [AuthGuard], component: Acceuil },
  { path: 'buy', canActivate: [AuthGuard], component: Buy },
  { path: 'map', canActivate: [AuthGuard], component: MapPage },
  { path: 'messages', canActivate: [AuthGuard], component: MessagesPage },
  { path: 'dashboard', canActivate: [AuthGuard], component: DashboardPage },
  { path: 'notifications', canActivate: [AuthGuard], component: NotificationsPage },
  { path: 'transactions', canActivate: [AuthGuard], component: TransactionsPage },
  { path: 'annonce/:id', canActivate: [AuthGuard], component: AnnonceDetail },
  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    component: AdminDashboard,
  },
  {
    path: 'admin/users',
    canActivate: [AuthGuard, AdminGuard],
    component: AdminUsers,
  },
  {
    path: 'admin/announcements',
    canActivate: [AuthGuard, AdminGuard],
    component: AdminAnnouncements,
  },
  {
    path: 'admin/gamification',
    canActivate: [AuthGuard, AdminGuard],
    component: AdminGamification,
  },
  {
    path: 'admin/ecology',
    canActivate: [AuthGuard, AdminGuard],
    component: AdminEcology,
  },
  /** Liens du menu (Sell, etc.) */
  { path: 'sell', redirectTo: 'create-announce', pathMatch: 'full' },
  {
    path: 'create-announce',
    canActivate: [AuthGuard],
    component: CreateAnnouncePage,
  },
  {
    path: 'announce-history',
    canActivate: [AuthGuard],
    component: AnnounceHistoryPage,
  },

  {
    path: 'login',
    canActivate: [GuestGuard],
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [GuestGuard],
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    canActivate: [GuestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then(
        (m) => m.ForgotPasswordPage,
      ),
  },
  {
    path: 'profile',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/profile/profile/profile').then((m) => m.ProfilePage),
  },
  {
    path: 'profile/edit',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/profile/edit-profile/edit-profile').then(
        (m) => m.EditProfilePage,
      ),
  },
  /** Ancien lien / raccourci « Paramètres » → édition du profil */
  {
    path: 'settings',
    redirectTo: '/profile/edit',
    pathMatch: 'full',
  },
  {
    path: 'edit-profile',
    redirectTo: '/profile/edit',
    pathMatch: 'full',
  },

  { path: '**', redirectTo: '' },
];
