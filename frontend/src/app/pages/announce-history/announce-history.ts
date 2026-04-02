import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { ItemService, ItemResponse } from '../../services/item.service';
import { AnnounceListComponent } from '../../components/announce-list/announce-list';
import { NavBar } from '../../components/nav-bar/nav-bar';

@Component({
  selector: 'app-announce-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    AnnounceListComponent,
    NavBar,
  ],
  templateUrl: './announce-history.html',
  styleUrl: './announce-history.css',
})
export class AnnounceHistoryPage implements OnInit {
  announces: ItemResponse[] = [];
  filteredAnnounces: ItemResponse[] = [];
  isLoading = true;
  errorMessage: string | null = null;
  emptyMessage: string | null = null;

  // Filter properties
  filterCategory: string = '';
  filterStatus: string = '';
  categories: string[] = [];
  /** Statuts Prisma (item_status) — pas « active » */
  statuses: string[] = [
    'PUBLISHED',
    'DRAFT',
    'RESERVED',
    'UNAVAILABLE',
    'EXPIRED',
    'BLOCKED',
  ];

  constructor(
    private readonly itemService: ItemService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadUserAnnounces();
  }

  loadUserAnnounces(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.emptyMessage = null;

    this.itemService
      .getUserAnnounces()
      .pipe(timeout(45_000))
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.announces = Array.isArray(data) ? data : [];
            if (this.announces.length === 0) {
              this.emptyMessage =
                'No announcements for this account. Create one or verify you are logged in with the same account used during creation.';
              this.filteredAnnounces = [];
              this.categories = [];
            } else {
              this.emptyMessage = null;
              this.categories = [
                ...new Set(
                  this.announces.map((a) => a.category).filter(Boolean),
                ),
              ].sort() as string[];
              this.applyFilters();
            }
            this.cdr.markForCheck();
          });
        },
        error: (error: unknown) => {
          console.error('Error loading announcements:', error);
          this.ngZone.run(() => {
            this.isLoading = false;
            const e = error as {
              name?: string;
              message?: string;
              error?: { message?: string | string[] };
            };
            if (e?.name === 'TimeoutError') {
              this.errorMessage =
                'Server not responding (timeout). Verify that the backend is running on http://localhost:4000.';
            } else if (Array.isArray(e?.error?.message)) {
              this.errorMessage = e.error!.message.join(' • ');
            } else if (typeof e?.error?.message === 'string') {
              this.errorMessage = e.error.message;
            } else if (typeof e?.message === 'string') {
              this.errorMessage = e.message;
            } else {
              this.errorMessage =
                'Unable to load your announcements. Check the connection and try again.';
            }
            this.cdr.markForCheck();
          });
        },
      });
  }

  applyFilters(): void {
    this.filteredAnnounces = this.announces.filter((announce) => {
      const matchCategory =
        !this.filterCategory || announce.category === this.filterCategory;
      const matchStatus =
        !this.filterStatus ||
        announce.status.toUpperCase() === this.filterStatus.toUpperCase();
      return matchCategory && matchStatus;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.filterCategory = '';
    this.filterStatus = '';
    this.applyFilters();
  }

  onAnnounceDeleted(announceId: string): void {
    this.announces = this.announces.filter((a) => a.id !== announceId);
    this.applyFilters();
  }

  onAnnounceUpdated(updatedAnnounce: ItemResponse): void {
    const index = this.announces.findIndex((a) => a.id === updatedAnnounce.id);
    if (index !== -1) {
      this.announces[index] = updatedAnnounce;
    }
    this.applyFilters();
  }
}
