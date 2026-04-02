import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AdminNavBar } from './components/admin-nav-bar/admin-nav-bar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AdminNavBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);

  /** Purple admin chrome only on `/admin` routes (not mixed with user NavBar). */
  protected readonly isAdminRoute = signal(false);

  constructor() {
    const sync = () => {
      const path = this.router.url.split('?')[0];
      this.isAdminRoute.set(path === '/admin' || path.startsWith('/admin/'));
    };
    sync();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => sync());
  }
}
