import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
  ) {}

  canActivate(): Observable<boolean | ReturnType<Router['createUrlTree']>> {
    return this.auth.authReady$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => {
        const existing = this.auth.getCurrentUser() ?? this.auth.user$.value;
        if (existing) return of(true);

        // Très court délai : laisser Firebase terminer la restauration de session au refresh
        return timer(150).pipe(
          switchMap(() => {
            const u = this.auth.getCurrentUser() ?? this.auth.user$.value;
            if (u) return of(true);
            return of(this.router.createUrlTree(['/login']));
          }),
        );
      }),
    );
  }
}
