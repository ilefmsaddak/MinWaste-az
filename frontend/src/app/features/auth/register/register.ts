import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
    }
  }
`;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class RegisterPage {
  displayName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private auth: FirebaseAuthService,
    private apollo: Apollo,
    private router: Router
  ) {}

  async submit() {
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      // Create the user on Firebase
      const email = this.email.trim();
      const fbUser = await this.auth.register(
        email,
        this.password,
        this.displayName,
      );

      // Token depuis l’utilisateur créé (évite une course avec currentUser / user$).
      const token = await fbUser.getIdToken();
      const displayName = this.displayName.trim();
      const phone = this.phone.trim();
      await firstValueFrom(
        this.apollo
          .mutate({
            mutation: UPDATE_PROFILE_MUTATION,
            variables: {
              input: {
                displayName: displayName || null,
                phone: phone || null,
              },
            },
            context: {
              headers: { Authorization: `Bearer ${token}` } as any,
            },
          })
          .pipe(timeout(45_000)),
      );

      this.success = 'Account created. Please verify your email before signing in.';
      this.router.navigate(['/login']);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? '');
      if (e?.name === 'TimeoutError' || msg.includes('Timeout')) {
        this.error =
          'Le serveur ne répond pas. Démarrez le backend (npm run start:dev) sur le port 4000.';
      } else {
        this.error = msg || 'Register failed';
      }
    } finally {
      this.loading = false;
    }
  }
}