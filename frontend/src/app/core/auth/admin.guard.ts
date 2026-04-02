import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';
import { FirebaseAuthService } from './firebase-auth.service';

const ME_ROLE = gql`
  query AdminGuardMe {
    me {
      id
      role
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
    private readonly apollo: Apollo,
  ) {}

  async canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean | UrlTree> {
    await firstValueFrom(
      this.auth.authReady$.pipe(filter(Boolean), take(1), timeout(8000)),
    ).catch(() => undefined);

    const fbUser = this.auth.getCurrentUser() ?? this.auth.user$.value;
    if (!fbUser) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    const token = await this.auth.getIdToken();
    if (!token) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    try {
      const res = await firstValueFrom(
        this.apollo.query({
          query: ME_ROLE,
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
          context: {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        }),
      );

      const gqlErrors = (res as { errors?: readonly { message?: string }[] })
        .errors;
      if (gqlErrors?.length) {
        return this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        });
      }

      const role = (res.data as { me?: { role?: string } } | undefined)?.me
        ?.role;
      if (String(role).toUpperCase() === 'ADMIN') {
        return true;
      }
    } catch {
      /* fall through */
    }

    return this.router.createUrlTree(['/']);
  }
}
