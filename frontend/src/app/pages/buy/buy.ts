import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { AnnonceData, AnnonceDataService } from '../../services/annonce-data.service';
import { SlugService } from '../../services/slug.service';

type TimeFilter = 'any' | '24h' | '3d' | '7d';

@Component({
  selector: 'app-buy',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './buy.html',
  styleUrl: './buy.scss',
})
export class Buy implements OnInit {
  annonces: AnnonceData[] = [];
  filteredAnnonces: AnnonceData[] = [];
  isLoading = false;
  error: string | null = null;

  selectedAvailability: string[] = [];
  selectedPriceTypes: string[] = [];
  minPrice: number | null = null;
  maxPrice: number | null = null;
  searchQuery = '';
  placeQuery = '';
  timeFilter: TimeFilter = 'any';

  readonly availabilityOptions = [
    { value: 'pending', label: 'Available' },
    { value: 'unavailable', label: 'Unavailable' },
    { value: 'expired', label: 'Expired' },
  ];

  readonly priceTypeOptions = [
    { value: 'free', label: 'Free' },
    { value: 'unit', label: 'Per unit' },
    { value: 'bulk', label: 'In bulk' },
  ];

  constructor(
    private readonly annonceDataService: AnnonceDataService,
    private readonly router: Router,
    private readonly slugService: SlugService,
  ) {}

  ngOnInit(): void {
    this.loadAnnonces();
  }

  loadAnnonces(): void {
    this.isLoading = true;
    this.error = null;

    this.annonceDataService.getAnnonces().subscribe({
      next: (data) => {
        this.annonces = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.error = `Failed to load products: ${message}`;
        this.isLoading = false;
      },
    });
  }

  toggleAvailability(value: string, checked: boolean): void {
    this.selectedAvailability = checked
      ? [...this.selectedAvailability, value]
      : this.selectedAvailability.filter((status) => status !== value);
    this.applyFilters();
  }

  togglePriceType(value: string, checked: boolean): void {
    this.selectedPriceTypes = checked
      ? [...this.selectedPriceTypes, value]
      : this.selectedPriceTypes.filter((priceType) => priceType !== value);
    this.applyFilters();
  }

  onMinPriceChange(value: string): void {
    this.minPrice = value.trim() === '' ? null : Number(value);
    this.applyFilters();
  }

  onMaxPriceChange(value: string): void {
    this.maxPrice = value.trim() === '' ? null : Number(value);
    this.applyFilters();
  }

  onPlaceChange(value: string): void {
    this.placeQuery = value;
    this.applyFilters();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.applyFilters();
  }

  onTimeFilterChange(value: TimeFilter): void {
    this.timeFilter = value;
    this.applyFilters();
  }

  resetFilters(): void {
    this.selectedAvailability = [];
    this.selectedPriceTypes = [];
    this.minPrice = null;
    this.maxPrice = null;
    this.searchQuery = '';
    this.placeQuery = '';
    this.timeFilter = 'any';
    this.applyFilters();
  }

  applyFilters(): void {
    const searchQuery = this.searchQuery.trim().toLowerCase();
    const placeQuery = this.placeQuery.trim().toLowerCase();

    this.filteredAnnonces = this.annonces.filter((annonce) => {
      const status = this.getEffectiveStatus(annonce);
      const priceType = annonce.priceType.toLowerCase();
      const priceAmount = annonce.priceType.toLowerCase() === 'free' ? 0 : (annonce.priceAmount ?? 0);
      const location = annonce.location?.addr?.toLowerCase() ?? '';
      const title = annonce.title.toLowerCase();
      const description = (annonce.description ?? '').toLowerCase();
      const category = (annonce.category ?? '').toLowerCase();

      const matchesSearch =
        searchQuery.length === 0 ||
        title.includes(searchQuery) ||
        description.includes(searchQuery) ||
        category.includes(searchQuery) ||
        location.includes(searchQuery);

      const matchesAvailability =
        this.selectedAvailability.length === 0 || this.selectedAvailability.includes(status);

      const matchesPriceType =
        this.selectedPriceTypes.length === 0 || this.selectedPriceTypes.includes(priceType);

      const matchesMinPrice = this.minPrice === null || priceAmount >= this.minPrice;
      const matchesMaxPrice = this.maxPrice === null || priceAmount <= this.maxPrice;

      const matchesPlace = placeQuery.length === 0 || location.includes(placeQuery);
      const matchesTime = this.matchesTimeFilter(annonce.createdAt);

      return (
        matchesSearch &&
        matchesAvailability &&
        matchesPriceType &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesPlace &&
        matchesTime
      );
    });
  }

  getEffectiveStatus(annonce: AnnonceData): string {
    if (annonce.expiresAt) {
      const expiresAt = new Date(annonce.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return 'expired';
      }
    }

    const s = annonce.status.toLowerCase();
    // Filtres UI « Available » = clé `pending` (legacy) ; API Prisma = PUBLISHED / RESERVED
    if (s === 'published' || s === 'reserved' || s === 'draft') {
      return 'pending';
    }
    return s;
  }

  matchesTimeFilter(createdAt: string): boolean {
    if (this.timeFilter === 'any') {
      return true;
    }

    const now = new Date();
    const createdDate = new Date(createdAt);
    const ageInHours = (now.getTime() - createdDate.getTime()) / 3600000;

    if (this.timeFilter === '24h') {
      return ageInHours <= 24;
    }

    if (this.timeFilter === '3d') {
      return ageInHours <= 72;
    }

    return ageInHours <= 168;
  }

  getPhotoUrl(photos: string[]): string {
    return photos.length > 0 ? photos[0] : 'assets/banner.jpg';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Available',
      published: 'Available',
      reserved: 'Reserved',
      draft: 'Draft',
      expired: 'Expired',
      unavailable: 'Unavailable',
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

  getSellerInitial(name?: string): string {
    const n = (name ?? '').trim();
    return n.length > 0 ? n.charAt(0).toUpperCase() : 'U';
  }

  /** Aligné sur la fiche annonce : trust_score 0–100 → note /5. */
  getSellerTrustFormatted(trustScore?: number): string {
    const t = Number(trustScore ?? 50);
    const normalized = Math.max(0, Math.min(5, t / 20));
    return normalized.toFixed(1);
  }

  getSellerTrustStarIcons(trustScore?: number): string[] {
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

  openAnnonce(annonce: AnnonceData): void {
    const segment = this.slugService.generateSlug(annonce.title || 'item', annonce.id);
    this.router.navigate(['/annonce', segment]);
  }
}
