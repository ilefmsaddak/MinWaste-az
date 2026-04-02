import { Component, NgZone, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Apollo, gql } from 'apollo-angular';
import { Router, RouterModule } from '@angular/router';
import { FirebaseAuthService } from '../../../core/auth/firebase-auth.service';
import { NavBar } from '../../../components/nav-bar/nav-bar';
import { MessageSocketService } from '../../../services/message-socket.service';
import { UserRoleService } from '../../../core/auth/user-role.service';
import { User } from 'firebase/auth';
import { distinctUntilChanged, map, Subject, takeUntil } from 'rxjs';

const MY_PROFILE = gql`
  query MyProfile {
    myProfile {
      user {
        id
        email
        displayName
        phone
        role
        points
        trustScore
      }
      badges {
        id
        code
        name
        description
        earnedAt
      }
      history {
        id
        role
        kind
        status
        quantity
        createdAt
        item {
          id
          title
          type
          priceType
          priceAmount
          currency
        }
      }
      notificationPreferences {
        reservationCreated
        reservationCanceled
        badgeEarned
      }
      privacySettings {
        showEmail
        showPhone
        showHistory
        showBadges
      }
    }
  }
`;

const UPDATE_NOTIF_PREFS = gql`
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {
      reservationCreated
      reservationCanceled
      badgeEarned
    }
  }
`;

const UPDATE_PRIVACY = gql`
  mutation UpdatePrivacySettings($input: UpdatePrivacySettingsInput!) {
    updatePrivacySettings(input: $input) {
      showEmail
      showPhone
      showHistory
      showBadges
    }
  }
`;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NavBar],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class ProfilePage implements OnInit, OnDestroy {
  loading = true;
  profile: any = null;
  error: string | null = null;
  isEmpty = false;

  // Modals state
  showNotifModal = false;
  showPrivacyModal = false;
  showEcoModal = false;

  // Saving states
  savingNotif = false;
  savingPrivacy = false;
  savingEco = false;

  // Temp values for modals
  tempNotifPrefs: any = null;
  tempPrivacySettings: any = null;
  tempEcoPrefs: any = null;

  private lastLoadedUid: string | null = null;
  private readonly destroy$ = new Subject<void>();
  private loadSeq = 0;

  constructor(
    private apollo: Apollo,
    private auth: FirebaseAuthService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private readonly messageSocket: MessageSocketService,
    private readonly userRole: UserRoleService,
  ) {}

  private inZone(fn: () => void) {
    this.ngZone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    console.log('[ProfilePage] === NG ON INIT ===');
    this.auth.user$
      .pipe(
        map((u) => u ?? null),
        distinctUntilChanged((a, b) => a?.uid === b?.uid),
        takeUntil(this.destroy$),
      )
      .subscribe((user) => {
        console.log('[ProfilePage] 🔔 User observable emitted:', user?.uid, user?.email);
        void this.loadProfileForUser(user);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadProfileForUser(user: User | null) {
    const seq = ++this.loadSeq;

    console.log('[ProfilePage] === LOAD PROFILE START ===');
    console.log('[ProfilePage] User:', user?.uid, user?.email);

    // State 1: No user logged in
    if (!user) {
      this.lastLoadedUid = null;
      this.inZone(() => {
        this.profile = null;
        this.error = null;
        this.loading = false;
        this.isEmpty = false;
      });
      console.log('[ProfilePage] ✅ No user, state reset');
      return;
    }

    // Prevent duplicate concurrent loads if Firebase re-emits the same user.
    if (this.lastLoadedUid === user.uid && this.loading) {
      console.log('[ProfilePage] ⚠️  Duplicate load prevented for same user');
      return;
    }
    this.lastLoadedUid = user.uid;

    // Reset state et afficher loading
    this.inZone(() => {
      this.loading = true;
      this.error = null;
      this.isEmpty = false;
      this.profile = null; // Reset to avoid displaying old data
    });

    console.log('[ProfilePage] ✅ Loading state set to true');

    try {
      const token = await user.getIdToken();
      if (!token) throw new Error('Missing auth token');

      console.log('[ProfilePage] ✅ Token obtained, calling GraphQL...');

      const result: any = await this.apollo.query({
        query: MY_PROFILE,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
        context: {
          headers: { Authorization: `Bearer ${token}` } as any,
        },
      }).toPromise();

      console.log('[ProfilePage] ✅ GraphQL response received');

      if (result?.error && Object.keys(result.error).length > 0) {
        throw new Error(`Network error: ${JSON.stringify(result.error)}`);
      }

      if (seq !== this.loadSeq) {
        console.log('[ProfilePage] ⚠️  Stale result ignored (newer load started)');
        return;
      }

      const gqlErrors = result?.errors as any[] | undefined;
      if (gqlErrors?.length) {
        const msg = gqlErrors.map((e) => e?.message).filter(Boolean).join(' • ');
        throw new Error(msg || 'GraphQL error');
      }

      const nextProfile = result?.data?.myProfile ?? null;
      
      if (!nextProfile) {
        throw new Error('Profile query returned null');
      }
      
      if (!nextProfile.user) {
        throw new Error('Profile query returned incomplete data');
      }

      if (nextProfile.user?.id) {
        try {
          localStorage.setItem('userId', nextProfile.user.id);
        } catch {
          /* ignore quota / private mode */
        }
        this.messageSocket.ensureSocketConnected();
        void this.userRole.refresh();
      }

      console.log('[ProfilePage] ✅ Profile data received:', {
        userId: nextProfile.user?.id,
        points: nextProfile.user?.points,
        trustScore: nextProfile.user?.trustScore,
        badgesCount: nextProfile.badges?.length || 0,
        historyCount: nextProfile.history?.length || 0,
      });

      const raw = nextProfile;
      const mutableProfile: any = {
        ...raw,
        user: raw.user ? { ...raw.user } : raw.user,
        badges: Array.isArray(raw.badges) ? [...raw.badges] : [],
        history: Array.isArray(raw.history) ? [...raw.history] : [],
        notificationPreferences: raw.notificationPreferences
          ? { ...raw.notificationPreferences }
          : undefined,
        privacySettings: raw.privacySettings ? { ...raw.privacySettings } : undefined,
      };

      mutableProfile.notificationPreferences = mutableProfile.notificationPreferences ?? {
        reservationCreated: true,
        reservationCanceled: true,
        badgeEarned: true,
      };
      mutableProfile.privacySettings = mutableProfile.privacySettings ?? {
        showEmail: false,
        showPhone: false,
        showHistory: true,
        showBadges: true,
      };

      // State 2: Success with data OR State 3: Success without data (new user)
      const hasData = (mutableProfile.badges?.length > 0) || (mutableProfile.history?.length > 0);
      
      this.inZone(() => {
        this.profile = mutableProfile;
        this.loading = false;
        this.error = null;
        this.isEmpty = !hasData; // New user without history or badges
        
        console.log('[ProfilePage] ✅ State after assignment:', {
          loading: this.loading,
          hasProfile: !!this.profile,
          hasError: !!this.error,
          isEmpty: this.isEmpty,
        });
      });

      console.log('[ProfilePage] ✅ Profile loaded successfully, isEmpty:', !hasData);
    } catch (e: any) {
      if (seq !== this.loadSeq) {
        console.log('[ProfilePage] ⚠️  Error ignored (newer load started)');
        return;
      }
      
      // État 4 : Error
      const errorMsg = `${e?.code ?? ''} ${e?.message ?? 'Failed to load profile'}`.trim();
      console.error('[ProfilePage] ❌ Error loading profile:', errorMsg);
      
      this.inZone(() => {
        this.error = errorMsg;
        this.loading = false;
        this.profile = null;
        this.isEmpty = false;
      });
    }
  }

  goToEditProfile(): void {
    const u = this.profile?.user;
    if (u) {
      this.router.navigate(['/profile/edit'], {
        state: {
          editPrefill: {
            displayName: u.displayName ?? '',
            phone: u.phone ?? '',
            email: u.email ?? '',
          },
        },
      });
    } else {
      this.router.navigate(['/profile/edit']);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  async logout() {
    this.messageSocket.disconnect();
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ── NOTIFICATIONS MODAL ──
  openNotifModal() {
    if (!this.profile?.notificationPreferences) {
      console.error('[ProfilePage] Cannot open notif modal: no preferences in profile');
      return;
    }
    this.tempNotifPrefs = { ...this.profile.notificationPreferences };
    this.showNotifModal = true;
    console.log('[ProfilePage] Notif modal opened with:', this.tempNotifPrefs);
  }

  closeNotifModal() {
    this.showNotifModal = false;
    this.tempNotifPrefs = null;
  }

  async saveNotifPrefs() {
    if (!this.tempNotifPrefs) {
      console.error('[ProfilePage] Cannot save: tempNotifPrefs is null');
      return;
    }

    console.log('[ProfilePage] Saving notif prefs:', this.tempNotifPrefs);
    this.savingNotif = true;

    try {
      const token = await this.auth.getIdToken();
      if (!token) throw new Error('No auth token');

      console.log('[ProfilePage] Calling updateNotificationPreferences mutation...');

      const result: any = await this.apollo.mutate({
        mutation: UPDATE_NOTIF_PREFS,
        variables: { input: this.tempNotifPrefs },
        context: {
          headers: { Authorization: `Bearer ${token}` } as any,
        },
      }).toPromise();

      console.log('[ProfilePage] Mutation result:', result);

      if (result?.data?.updateNotificationPreferences) {
        this.profile.notificationPreferences = result.data.updateNotificationPreferences;
        console.log('[ProfilePage] ✅ Notif prefs updated successfully');
      }

      this.closeNotifModal();
    } catch (e: any) {
      console.error('[ProfilePage] ❌ Error saving notif prefs:', e);
      alert(`Error: ${e?.message ?? 'Failed to save'}`);
    } finally {
      this.savingNotif = false;
    }
  }

  // ── PRIVACY MODAL ──
  openPrivacyModal() {
    if (!this.profile?.privacySettings) {
      console.error('[ProfilePage] Cannot open privacy modal: no settings in profile');
      return;
    }
    this.tempPrivacySettings = { ...this.profile.privacySettings };
    this.showPrivacyModal = true;
    console.log('[ProfilePage] Privacy modal opened with:', this.tempPrivacySettings);
  }

  closePrivacyModal() {
    this.showPrivacyModal = false;
    this.tempPrivacySettings = null;
  }

  async savePrivacySettings() {
    if (!this.tempPrivacySettings) {
      console.error('[ProfilePage] Cannot save: tempPrivacySettings is null');
      return;
    }

    console.log('[ProfilePage] Saving privacy settings:', this.tempPrivacySettings);
    this.savingPrivacy = true;

    try {
      const token = await this.auth.getIdToken();
      if (!token) throw new Error('No auth token');

      console.log('[ProfilePage] Calling updatePrivacySettings mutation...');

      const result: any = await this.apollo.mutate({
        mutation: UPDATE_PRIVACY,
        variables: { input: this.tempPrivacySettings },
        context: {
          headers: { Authorization: `Bearer ${token}` } as any,
        },
      }).toPromise();

      console.log('[ProfilePage] Mutation result:', result);

      if (result?.data?.updatePrivacySettings) {
        this.profile.privacySettings = result.data.updatePrivacySettings;
        console.log('[ProfilePage] ✅ Privacy settings updated successfully');
      }

      this.closePrivacyModal();
    } catch (e: any) {
      console.error('[ProfilePage] ❌ Error saving privacy settings:', e);
      alert(`Error: ${e?.message ?? 'Failed to save'}`);
    } finally {
      this.savingPrivacy = false;
    }
  }

  // ── ECO PREFERENCES (placeholder for future) ──
  openEcoModal() {
    this.tempEcoPrefs = {
      receiveEcoInsights: true,
      trackImpact: true,
      receiveRecommendations: true,
    };
    this.showEcoModal = true;
  }

  closeEcoModal() {
    this.showEcoModal = false;
    this.tempEcoPrefs = null;
  }

  async saveEcoPrefs() {
    // Placeholder: for now just close the modal
    // To implement later if needed
    this.closeEcoModal();
  }
}