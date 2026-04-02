import { Injectable, inject, signal } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FirebaseAuthService } from './firebase-auth.service';

const ME_ROLE = gql`
  query UserRoleMe {
    me {
      role
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  private readonly apollo = inject(Apollo);
  private readonly auth = inject(FirebaseAuthService);

  /** True when the DB user has role ADMIN (after {@link refresh}). */
  readonly isAdmin = signal(false);

  async refresh(): Promise<void> {
    const token = await this.auth.getIdToken();
    if (!token) {
      this.isAdmin.set(false);
      return;
    }
    try {
      const res = await firstValueFrom(
        this.apollo.query({
          query: ME_ROLE,
          fetchPolicy: 'network-only',
          context: {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        }),
      );
      const role = (res.data as { me?: { role?: string } } | undefined)?.me
        ?.role;
      this.isAdmin.set(String(role).toUpperCase() === 'ADMIN');
    } catch {
      this.isAdmin.set(false);
    }
  }
}
