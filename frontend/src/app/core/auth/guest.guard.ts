import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import { FirebaseAuthService } from './firebase-auth.service';

/**
 * Pages publiques (login / register) : si déjà connecté → accueil.
 */
@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  constructor(
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
  ) {}

  canActivate(): Observable<boolean | ReturnType<Router['createUrlTree']>> {
    return this.auth.authReady$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => {
        const u = this.auth.getCurrentUser() ?? this.auth.user$.value;
        if (u) {
          return of(this.router.createUrlTree(['/']));
        }
        return timer(0).pipe(
          switchMap(() => {
            const again = this.auth.getCurrentUser() ?? this.auth.user$.value;
            if (again) return of(this.router.createUrlTree(['/']));
            return of(true);
          }),
        );
      }),
    );
  }
}
