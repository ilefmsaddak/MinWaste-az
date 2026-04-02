import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { take, timeout } from 'rxjs/operators';
import { NavBar } from '../../components/nav-bar/nav-bar';
import {
  ItemService,
  ItemResponse,
  OwnerReviewPreview,
  ItemOwnerPreview,
} from '../../services/item.service';
import { ReservationService } from '../../services/reservation.service';
import { RecommendationsService } from '../../services/recommendations.service';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { AnnonceDataService } from '../../services/annonce-data.service';
import { SlugService } from '../../services/slug.service';

const PG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AnnonceDetailData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  location?: { addr: string };
  status: string;
  priceType: string;
  priceAmount?: number;
  quantityTotal: number;
  quantityAvailable: number;
  createdAt: string;
  expiresAt?: string;
  photos?: string[];
  ownerId: string;
  fraudScore?: number;
  owner?: ItemOwnerPreview;
  ownerReviews?: OwnerReviewPreview[];
}

@Component({
  selector: 'app-annonce-detail',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './annonce-detail.html',
  styleUrl: './annonce-detail.scss',
})
export class AnnonceDetail implements OnInit, OnDestroy {
  annonce: AnnonceDetailData | null = null;
  selectedPhotoIndex = 0;
  isLoading = false;
  error: string | null = null;
  isReserving = false;
  reservationSuccess = false;
  showGoToTransactions = false;

  private routeSubscription: Subscription | null = null;
  private annonceSubscription: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly itemService: ItemService,
    private readonly reservationService: ReservationService,
    private readonly recommendationsService: RecommendationsService,
    private readonly auth: FirebaseAuthService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly annonceDataService: AnnonceDataService,
    private readonly slugService: SlugService,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');

      if (!idParam || idParam.trim() === '') {
        this.error = 'Invalid annonce id.';
        this.annonce = null;
        this.isLoading = false;
        return;
      }

      const raw = idParam.trim();
      if (PG_UUID_RE.test(raw)) {
        this.loadAnnonce(raw);
      } else {
        this.loadAnnonceBySlug(raw);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.annonceSubscription?.unsubscribe();
  }

  private loadAnnonceBySlug(slug: string): void {
    this.annonceSubscription?.unsubscribe();
    this.isLoading = true;
    this.error = null;

    this.annonceSubscription = this.annonceDataService
      .getAnnonces()
      .pipe(take(1))
      .subscribe({
        next: (annonces) => {
          const resolvedId = this.slugService.extractIdFromSlug(slug, annonces);
          if (!resolvedId) {
            this.ngZone.run(() => {
              this.isLoading = false;
              this.error = 'Annonce introuvable (lien slug).';
              this.annonce = null;
              this.cdr.markForCheck();
            });
            return;
          }
          this.loadAnnonce(resolvedId);
        },
        error: () => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.error = 'Impossible de charger les annonces pour ce lien.';
            this.annonce = null;
            this.cdr.markForCheck();
          });
        },
      });
  }

  loadAnnonce(id: string): void {
    this.annonceSubscription?.unsubscribe();
    this.isLoading = true;
    this.error = null;
    this.showGoToTransactions = false;

    this.annonceSubscription = this.itemService
      .getItemById(id)
      .pipe(timeout(45_000))
      .subscribe({
        next: (item: ItemResponse) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            if (item?.id) {
              const pt = String(item.priceType ?? '').toLowerCase();
              const st = String(item.status ?? '').toLowerCase();
              this.annonce = {
                id: item.id,
                title: item.title,
                description: item.description,
                category: item.category,
                location: { addr: item.locationAddr },
                status: st,
                priceType: pt,
                priceAmount: item.priceValue,
                quantityTotal: item.quantity,
                quantityAvailable: item.quantityAvailable ?? item.quantity,
                createdAt: item.createdAt,
                expiresAt: item.expiresAt,
                photos: item.photos?.length ? item.photos : [],
                ownerId: item.ownerId,
                fraudScore:
                  item.fraudScore != null ? Number(item.fraudScore) : undefined,
                owner: item.owner,
                ownerReviews: item.ownerReviews,
              };
              this.selectedPhotoIndex = 0;
              this.error = null;
              
              // Track view for recommendations (non-blocking)
              this.recommendationsService.trackView(item.id).catch(() => {});
            } else {
              this.annonce = null;
              this.error = 'Annonce not found.';
            }
            this.cdr.markForCheck();
          });
        },
        error: (err: unknown) => {
          console.error('Error loading annonce:', err);
          this.ngZone.run(() => {
            this.isLoading = false;
            const msg =
              (err as { name?: string })?.name === 'TimeoutError'
                ? 'The server did not respond in time. Is the backend running on port 4000?'
                : 'Failed to load annonce details.';
            this.error = msg;
            this.annonce = null;
            this.cdr.markForCheck();
          });
        },
      });
  }

  selectPhoto(index: number): void {
    if (!this.annonce || !this.annonce.photos || index < 0 || index >= this.annonce.photos.length) {
      return;
    }

    this.selectedPhotoIndex = index;
  }

  getSelectedPhoto(): string {
    if (!this.annonce) {
      return 'assets/placeholder.jpg';
    }

    if (!this.annonce.photos || this.annonce.photos.length === 0) {
      return 'assets/placeholder.jpg';
    }

    return this.annonce.photos[this.selectedPhotoIndex] ?? this.annonce.photos[0];
  }

  getEffectiveStatus(annonce: AnnonceDetailData): string {
    if (annonce.expiresAt) {
      const expiresAt = new Date(annonce.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return 'expired';
      }
    }

    return annonce.status.toLowerCase();
  }

  getStatusClass(annonce: AnnonceDetailData): string {
    return `status-${this.getEffectiveStatus(annonce)}`;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Available',
      pending: 'Available',
      published: 'Available',
      reserved: 'Reserved',
      draft: 'Draft',
      expired: 'Expired',
      unavailable: 'Unavailable',
      blocked: 'Unavailable',
    };

    return labels[status.toLowerCase()] ?? status;
  }

  getPriceLabel(priceType: string): string {
    const labels: Record<string, string> = {
      free: 'Free',
      unit: 'Per unit',
      bulk: 'In bulk',
    };

    return labels[priceType.toLowerCase()] ?? priceType;
  }

  canReserve(annonce: AnnonceDetailData): boolean {
    // ✅ SIMPLIFIED: Trust backend to calculate correct status
    // Backend computes status based on: BLOCKED → DRAFT → EXPIRED → quantity logic → PUBLISHED/RESERVED/UNAVAILABLE
    
    const now = new Date();
    
    // Check if expired
    if (annonce.expiresAt) {
      const expiresAt = new Date(annonce.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
        return false; // Item expired
      }
    }
    
    // Check if status is not reservable (DRAFT, BLOCKED)
    const status = annonce.status.toLowerCase();
    if (['draft', 'blocked', 'unavailable', 'expired', 'reserved'].includes(status)) {
      return false;
    }
    
    // Primary check: quantity available
    // If quantityAvailable >= 1 and not in non-reservable state, it's reservable
    return annonce.quantityAvailable >= 1;
  }

  private parseReservationError(err: any): string {
    const gqlMessage =
      err?.graphQLErrors?.[0]?.message ??
      err?.networkError?.result?.errors?.[0]?.message ??
      err?.message ??
      '';
    const normalized = String(gqlMessage).toLowerCase();

    if (normalized.includes('already have a pending reservation')) {
      return 'You already have a pending reservation for this item. Check your Transactions page.';
    }

    if (normalized.includes('item is not available for reservation')) {
      return 'This item is no longer available. Please refresh or choose another item.';
    }

    if (normalized.includes('insufficient quantity available')) {
      return 'The requested quantity is no longer available.';
    }

    if (normalized.includes('cannot reserve your own item')) {
      return 'You cannot reserve your own item.';
    }

    return 'Failed to create reservation. Please try again.';
  }

  async orderAnnonce(): Promise<void> {
    if (!this.annonce) {
      return;
    }

    if (this.isReserving) {
      return;
    }

    if (!this.canReserve(this.annonce)) {
      this.error = 'This item is currently not reservable.';
      return;
    }

    // Check if user is authenticated
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser) {
      this.error = 'Please log in to make a reservation';
      return;
    }

    // Check if user is trying to reserve their own item
    const userId = localStorage.getItem('userId');
    if (userId === this.annonce.ownerId) {
      this.error = 'You cannot reserve your own item';
      return;
    }

    this.isReserving = true;
    this.error = null;
    this.reservationSuccess = false;
    this.showGoToTransactions = false;

    try {
      const transactionId = await this.reservationService.createReservation(
        this.annonce.id,
        1 // Default quantity
      );

      console.log('Reservation created:', transactionId);
      
      this.reservationSuccess = true;
      this.error = null;

      // Refresh item data to show updated quantities
      await new Promise(resolve => setTimeout(resolve, 500));
      this.loadAnnonce(this.annonce!.id);

      // Show success message briefly then redirect to profile
      setTimeout(() => {
        this.ngZone.run(() => {
          this.router.navigate(['/profile']);
        });
      }, 2000);

    } catch (err: any) {
      const parsedMessage = this.parseReservationError(err);
      this.error = parsedMessage;
      this.showGoToTransactions = parsedMessage.toLowerCase().includes('pending reservation');
      this.reservationSuccess = false;

      // Keep concise log line without full browser stack trace noise.
      console.warn('Reservation rejected:', parsedMessage);

      // Keep details in sync when backend rejects because item state changed.
      this.loadAnnonce(this.annonce.id);
    } finally {
      this.isReserving = false;
      this.cdr.markForCheck();
    }
  }

  goToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  contactOwner(): void {
    if (!this.annonce) {
      return;
    }

    void this.router.navigate(['/messages'], {
      queryParams: { recipientId: this.annonce.ownerId },
    });
  }

  getOwnerName(): string {
    if (!this.annonce) return 'Seller';
    const name = this.annonce.owner?.displayName?.trim();
    if (name) return name;
    return `Owner #${this.annonce.ownerId}`;
  }

  getOwnerInitial(): string {
    return this.getOwnerName().charAt(0).toUpperCase();
  }

  /** Étoiles vendeur dérivées du trust_score (0–100). */
  getTrustStarIcons(trustScore?: number): string[] {
    const t = Number(trustScore ?? 50);
    const normalized = Math.max(0, Math.min(5, t / 20));
    const fullStars = Math.floor(normalized);
    const hasHalfStar = normalized - fullStars >= 0.5;
    const icons: string[] = [];
    for (let i = 0; i < fullStars; i += 1) icons.push('★');
    if (hasHalfStar) icons.push('⯨');
    while (icons.length < 5) icons.push('☆');
    return icons;
  }

  getTrustFormattedStars(trustScore?: number): string {
    const t = Number(trustScore ?? 50);
    const normalized = Math.max(0, Math.min(5, t / 20));
    return normalized.toFixed(1);
  }

  getFraudLevel(fraudScore?: number): string {
    if (fraudScore === undefined || fraudScore === null) {
      return 'Unknown';
    }
    if (fraudScore < 20) return 'Low';
    if (fraudScore < 60) return 'Medium';
    return 'High';
  }

  getFraudPercent(fraudScore?: number): number {
    if (fraudScore === undefined || fraudScore === null) {
      return 0;
    }
    return Math.max(0, Math.min(100, Number(fraudScore)));
  }

  getReviewStars(rating: number): string {
    const normalizedRating = Math.max(1, Math.min(5, Math.round(rating || 0)));
    return `${'★'.repeat(normalizedRating)}${'☆'.repeat(5 - normalizedRating)}`;
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    return `${diffDays}d ago`;
  }
}
