import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { FirebaseAuthService } from '../auth/firebase-auth.service';

function adminRestPathMatches(pathname: string): boolean {
  return /\/api\/(users|badges|leaderboard|announcements)(\/|$)/.test(pathname);
}

function requestPath(url: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname;
    }
    return url.split('?')[0];
  } catch {
    return url.split('?')[0];
  }
}

/**
 * Attaches the Firebase ID token to admin REST calls so Nest {@link AdminRoleRestGuard} can run.
 */
export const adminApiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const path = requestPath(req.url);
  if (!adminRestPathMatches(path)) {
    return next(req);
  }

  const auth = inject(FirebaseAuthService);
  return from(auth.getIdToken()).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }),
      );
    }),
  );
};
