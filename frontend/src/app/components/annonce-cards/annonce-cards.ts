import { Component, Input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ItemService, ItemResponse } from '../../services/item.service';
import { SlugService } from '../../services/slug.service';
import { RecommendationsService } from '../../services/recommendations.service';

interface AnnonceData {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  location?: { addr: string };
  status: string;
  priceType: string;
  priceAmount?: number;
  quantity: number;
  quantityAvailable?: number;
  createdAt: string;
  expiresAt?: string;
  photos?: string[];
  isRecommended?: boolean;
}

@Component({
  selector: 'app-annonce-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './annonce-cards.html',
  styleUrl: './annonce-cards.scss',
})
export class AnnonceCards implements OnInit {
  @Input() sectionTitle: string = 'Announcements';
  @Input() sectionId: string = '';
  @Input() includeRecommendations: boolean = false;

  annonces = signal<AnnonceData[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  /** IDs dont l'URL photo est invalide / erreur de chargement → fallback logo */
  private readonly brokenPhotoIds = signal(new Set<string>());

  constructor(
    private itemService: ItemService,
    private router: Router,
    private slugService: SlugService,
    private recommendationsService: RecommendationsService,
  ) {}

  ngOnInit() {
    this.loadAnnonces();
  }

  async loadAnnonces() {
    this.isLoading.set(true);
    this.error.set(null);

    console.log(`📡 Fetching items for section: ${this.sectionId || 'all'}...`);

    let lat: number | undefined;
    let lng: number | undefined;

    const fetchItems = async () => {
      // Load recommendations first if needed
      let recommendedItems: AnnonceData[] = [];
      const recommendedIds = new Set<string>();

      if (this.includeRecommendations && this.sectionId === 'for-you') {
        try {
          const recResponse = await this.recommendationsService.getRecommendations(6);
          if (recResponse.items && recResponse.items.length > 0) {
            recommendedItems = recResponse.items.map((item: any) => {
              recommendedIds.add(item.id);
              this.recommendationsService.markAsRecommended(item.id); // ✅ Persist in service (survives navigation)
              return {
                id: item.id,
                title: item.title,
                description: item.description,
                category: item.category,
                location: { addr: item.locationAddr || '' },
                status: String(item.status ?? '').toLowerCase(),
                priceType: String(item.priceType ?? '').toLowerCase(),
                priceAmount: item.priceAmount,
                quantity: item.quantity || 1,
                quantityAvailable: item.quantityAvailable,
                createdAt: item.createdAt || new Date().toISOString(),
                expiresAt: item.expiresAt,
                photos: item.photos ?? [],
                isRecommended: true,
              };
            });
          }
        } catch (err) {
          console.warn('⚠️ Failed to load recommendations, continuing with normal items:', err);
        }
      }

      // Load normal items
      this.itemService.getAllItems(this.sectionId, lat, lng).subscribe({
        next: (data: ItemResponse[]) => {
          console.log(`✅ Items loaded for ${this.sectionId}:`, data.length);

          // Get current user ID from localStorage
          const currentUserId = localStorage.getItem('userId');

          // Filter out user's own items and deduplicate with recommendations
          const mappedData: AnnonceData[] = data
            .filter(item => {
              // Hide user's own items from the marketplace
              if (currentUserId && item.ownerId === currentUserId) {
                return false;
              }
              // Deduplicate: exclude items already in recommendations
              if (recommendedIds.has(item.id)) {
                return false;
              }
              return true;
            })
            .map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              category: item.category,
              location: { addr: item.locationAddr },
              status: String(item.status ?? '').toLowerCase(),
              priceType: String(item.priceType ?? '').toLowerCase(),
              priceAmount: item.priceValue,
              quantity: item.quantity,
              quantityAvailable: item.quantityAvailable,
              createdAt: item.createdAt,
              expiresAt: item.expiresAt,
              photos: item.photos ?? [],
              // ✅ Check service (survives navigation) instead of local Set
              isRecommended: this.recommendationsService.wasRecommended(item.id),
            }));

          // Merge: recommendations first, then normal items
          let finalList = [...recommendedItems, ...mappedData];
          
          // ✅ Sort to ensure ALL recommended items appear first (handles navigation returns)
          if (this.sectionId === 'for-you') {
            finalList = finalList.sort((a, b) => {
              // Recommended items first
              if (a.isRecommended && !b.isRecommended) return -1;
              if (!a.isRecommended && b.isRecommended) return 1;
              // Preserve original order within each group
              return 0;
            });
          }
          
          this.annonces.set(finalList);
          this.isLoading.set(false);
        },
        error: (err: any) => {
          console.error(`❌ Error loading items for ${this.sectionId}:`, err);
          this.error.set(`Failed to load announcements: ${err.message || 'Unknown error'}`);
          this.isLoading.set(false);
        },
      });
    };

    if (this.sectionId === 'near-you') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            console.log(`📍 Geolocation active: ${lat}, ${lng}`);
            fetchItems();
          },
          (err) => {
            console.warn('⚠️ Geolocation blocked or failed, loading all:', err.message);
            fetchItems();
          },
          { timeout: 5000 }
        );
      } else {
        console.warn('⚠️ Geolocation not supported');
        fetchItems();
      }
    } else {
      fetchItems();
    }
  }

  getPhotoUrl(annonce: AnnonceData): string {
    const id = String(annonce.id);
    if (this.brokenPhotoIds().has(id)) {
      return '/logo.svg';
    }
    const photos = annonce.photos;
    if (!photos?.length) {
      return '/logo.svg';
    }
    const raw = String(photos[0] ?? '').trim();
    if (!raw) {
      return '/logo.svg';
    }
    // Évite d'afficher des URLs manifestement invalides (copier-coller d'erreur, etc.)
    if (
      raw.length > 2048 ||
      /node_modules|react-dom|createFiber|localhost:\d{4}\/error/i.test(raw)
    ) {
      return '/logo.svg';
    }
    return raw;
  }

  onPhotoError(annonce: AnnonceData): void {
    const id = String(annonce.id);
    this.brokenPhotoIds.update((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  getStatusBadgeClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'active': 'Available',
      'pending': 'Available',
      'published': 'Available',
      'reserved': 'Reserved',
      'draft': 'Draft',
      'expired': 'Expired',
      'unavailable': 'Unavailable'
    };
    return labels[status.toLowerCase()] || status;
  }

  getPriceLabel(priceType: string): string {
    const labels: { [key: string]: string } = {
      'free': 'Free',
      'unit': 'Per unit',
      'bulk': 'In bulk'
    };
    return labels[priceType.toLowerCase()] || priceType;
  }

  isExpiringSoon(expiresAtDate?: string): boolean {
    if (!expiresAtDate) return false;
    const expiry = new Date(expiresAtDate);
    const now = new Date();
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / 3600000;
    return hoursUntilExpiry <= 24 && hoursUntilExpiry > 0;
  }

  isExpired(expiresAtDate?: string): boolean {
    if (!expiresAtDate) return false;
    const expiry = new Date(expiresAtDate);
    return expiry < new Date();
  }

  /**
   * ✅ Check if item is available for reservation (mirrors backend logic)
   * Used to determine if we show "Available" or "Out of Stock" in the card
   */
  isAvailableForReservation(annonce: AnnonceData): boolean {
    // Check if expired
    if (this.isExpired(annonce.expiresAt)) {
      return false;
    }

    // Check if status is not reservable (DRAFT, BLOCKED, UNAVAILABLE)
    const status = annonce.status.toLowerCase();
    if (['draft', 'blocked', 'unavailable', 'expired'].includes(status)) {
      return false;
    }

    // Primary check: quantity available
    return (annonce.quantityAvailable ?? annonce.quantity) >= 1;
  }

  getExpiryLabel(expiresAtDate?: string): string {
    if (!expiresAtDate) return '';
    const expiry = new Date(expiresAtDate);
    const now = new Date();
    const diffHours = Math.floor((expiry.getTime() - now.getTime()) / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 0) return 'Expired';
    if (diffHours < 1) return 'Expires in < 1h';
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    return `Expires in ${diffDays}d`;
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  openAnnonce(annonce: AnnonceData): void {
    const id = String(annonce.id);
    this.router.navigate(['/annonce', id]);
  }
}
