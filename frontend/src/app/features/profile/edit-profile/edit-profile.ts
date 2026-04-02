import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Apollo, gql } from 'apollo-angular';
import { Router, RouterModule } from '@angular/router';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';
import { NavBar } from '../../../components/nav-bar/nav-bar';
import { filter, take, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

const ME_WITH_PROFILE = gql`
  query MeWithProfile {
    meWithProfile {
      displayName
      phone
      profile {
        bio
        city
        governorate
        avatarUrl
      }
    }
  }
`;

const UPDATE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { id displayName phone email }
  }
`;

function apolloErrorMessage(e: any): string {
  if (!e) return 'Unknown error';
  if (e.name === 'TimeoutError' || /timeout/i.test(String(e.message ?? ''))) {
    return 'Délai dépassé : le backend GraphQL ne répond pas. Lancez le serveur Nest (ex. port 4000) et vérifiez l’URL dans apollo.provider.ts.';
  }
  const gqlMsgs = e.graphQLErrors?.map((x: { message?: string }) => x?.message).filter(Boolean);
  if (gqlMsgs?.length) return gqlMsgs.join(' ');
  const net = e.networkError as { message?: string; error?: { message?: string } } | undefined;
  if (net?.error?.message) return net.error.message;
  if (typeof net?.message === 'string') return net.message;
  if (typeof e.message === 'string') return e.message;
  return 'Erreur de communication avec le serveur.';
}

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavBar],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.css'],
})
export class EditProfilePage implements OnInit {
  displayName = '';
  phone = '';
  bio = '';
  city = '';
  governorate = '';
  avatarUrl = '';
  email = '';
  newEmail = '';
  newPassword = '';
  confirmPassword = '';
  saving = false;
  changingEmail = false;
  changingPassword = false;
  sendingReset = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private apollo: Apollo,
    private router: Router,
    private auth: FirebaseAuthService,
  ) {}

  ngOnInit(): void {
    const navState = history.state as {
      editPrefill?: { displayName?: string; phone?: string; email?: string };
    };
    const pre = navState?.editPrefill;

    const fbUser = this.auth.getCurrentUser() ?? this.auth.user$.value;
    this.email = pre?.email ?? fbUser?.email ?? '';
    this.newEmail = this.email;
    this.displayName = (pre?.displayName ?? fbUser?.displayName)?.trim() ?? '';
    this.phone = pre?.phone ?? '';

    const runQuery = () => {
      this.apollo
        .query({
          query: ME_WITH_PROFILE,
          fetchPolicy: 'network-only',
        })
        .pipe(
          timeout(15000),
          catchError((e: unknown) => {
            console.error('[EditProfilePage] Error loading profile:', e);
            this.error = apolloErrorMessage(e);
            return of(null);
          }),
        )
        .subscribe({
          next: (r: unknown) => {
            const result = r as { data?: { meWithProfile?: any } } | null;
            if (!result?.data?.meWithProfile) return;
            const row = result.data.meWithProfile;
            this.displayName = row.displayName ?? this.displayName;
            this.phone = row.phone ?? this.phone;
            this.bio = row.profile?.bio ?? '';
            this.city = row.profile?.city ?? '';
            this.governorate = row.profile?.governorate ?? '';
            this.avatarUrl = row.profile?.avatarUrl ?? '';
          },
          error: (e: unknown) => {
            console.error('[EditProfilePage] Unable to load:', e);
            this.error = apolloErrorMessage(e);
          },
        });
    };

    if (fbUser != null) {
      runQuery();
    } else {
      this.auth.authReady$
        .pipe(filter(Boolean), take(1), timeout(8000))
        .subscribe({
          next: () => runQuery(),
          error: (e: unknown) => {
            console.error('[EditProfilePage] Auth ready timeout:', e);
            this.error = apolloErrorMessage(e);
          },
        });
    }
  }

  save() {
    console.log('[EditProfilePage] Saving profile...');
    this.saving = true;
    this.error = null;
    this.success = null;

    const displayName = this.displayName?.trim() ?? '';
    const phoneTrimmed = this.phone?.trim() ?? '';
    const bioTrimmed = this.bio?.trim() ?? '';
    const cityTrimmed = this.city?.trim() ?? '';
    const governorateTrimmed = this.governorate?.trim() ?? '';
    const avatarUrlTrimmed = this.avatarUrl?.trim() ?? '';

    const input: any = {
      displayName,
      phone: phoneTrimmed === '' ? null : phoneTrimmed,
      bio: bioTrimmed === '' ? null : bioTrimmed,
      city: cityTrimmed === '' ? null : cityTrimmed,
      governorate: governorateTrimmed === '' ? null : governorateTrimmed,
      avatarUrl: avatarUrlTrimmed === '' ? null : avatarUrlTrimmed,
    };

    console.log('[EditProfilePage] Mutation input:', input);

    this.apollo.mutate({
      mutation: UPDATE,
      variables: { input },
    }).subscribe({
      next: () => {
        console.log('[EditProfilePage] ✅ Profile updated successfully');
        this.saving = false;

        // ✅ Sync displayName to Firebase (separate from DB save)
        // Firebase only accepts displayName, other fields are in DB only
        this.auth
          .updateFirebaseDisplayName(this.displayName)
          .then(() => {
            console.log('[EditProfilePage] ✅ Firebase profile synced');
            this.success = 'Profile updated.';
            setTimeout(() => this.router.navigate(['/profile']), 1000);
          })
          .catch((fbErr) => {
            // Firebase sync failed but DB save succeeded - still show success
            console.warn(
              '[EditProfilePage] ⚠️ Firebase sync failed (DB save succeeded):',
              fbErr?.message,
            );
            this.success = 'Profile updated (Firebase sync delayed).';
            setTimeout(() => this.router.navigate(['/profile']), 1000);
          });
      },
      error: (e) => {
        console.error('[EditProfilePage] ❌ Error updating profile:', e);
        this.error = apolloErrorMessage(e);
        this.saving = false;
      },
    });
  }

  async changeEmail() {
    this.error = null;
    this.success = null;
    
    // Check if user is OAuth (Google) - they cannot change email in this way
    const user = this.auth.getCurrentUser();
    if (user?.providerData && user.providerData.length > 0) {
      const hasGoogleProvider = user.providerData.some((p: any) => p.providerId === 'google.com');
      if (hasGoogleProvider && !user.providerData.some((p: any) => p.providerId === 'password')) {
        this.error = 'Email changes are not available for Google accounts. Please use your Google account email.';
        return;
      }
    }
    
    this.changingEmail = true;
    try {
      await this.auth.changeEmail(this.newEmail);
      this.email = this.newEmail.trim();
      this.success = 'Email updated. Please check your inbox for verification.';
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to update email';
      // Provide helpful message for common Firebase errors
      if (msg.includes('requires-recent-login')) {
        this.error = 'Please log in again before changing your email.';
      } else if (msg.includes('email-already-in-use')) {
        this.error = 'This email is already in use by another account.';
      } else {
        this.error = msg;
      }
    } finally {
      this.changingEmail = false;
    }
  }

  async changePassword() {
    this.error = null;
    this.success = null;
    
    // Check if user is OAuth (Google) - they cannot have a password
    const user = this.auth.getCurrentUser();
    if (user?.providerData && user.providerData.length > 0) {
      const hasGoogleProvider = user.providerData.some((p: any) => p.providerId === 'google.com');
      if (hasGoogleProvider && !user.providerData.some((p: any) => p.providerId === 'password')) {
        this.error = 'Password management is not available for Google accounts.';
        return;
      }
    }
    
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    
    this.changingPassword = true;
    try {
      await this.auth.changePassword(this.newPassword);
      this.newPassword = '';
      this.confirmPassword = '';
      this.success = 'Password updated successfully.';
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to update password';
      // Firebase often requires recent login
      if (msg.includes('requires-recent-login') || msg.includes('operation-requires-active-session')) {
        this.error = 'Please log in again to change your password.';
      } else {
        this.error = msg;
      }
    } finally {
      this.changingPassword = false;
    }
  }

  async sendPasswordReset() {
    this.error = null;
    this.success = null;
    this.sendingReset = true;
    try {
      await this.auth.sendPasswordResetForCurrentUser();
      this.success = 'Password reset email sent.';
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to send reset email';
    } finally {
      this.sendingReset = false;
    }
  }
}