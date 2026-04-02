import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css'],
})
export class ForgotPasswordPage {
  email = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(private auth: FirebaseAuthService) {}

  async submit() {
    this.loading = true; this.error = null; this.success = null;
    try {
      await this.auth.forgotPassword(this.email);
      this.success = 'Email sent. Check your inbox.';
    } catch (e: any) {
      this.error = e?.message ?? 'Request failed';
    } finally {
      this.loading = false;
    }
  }
}