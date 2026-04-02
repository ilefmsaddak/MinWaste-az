import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAnnouncementsService, Announcement } from '../../services/admin-announcements.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-announcements.html',
  styleUrl: './admin-announcements.scss'
})
export class AdminAnnouncements implements OnInit {
  announcements = signal<Announcement[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  filterStatus = signal<'all' | 'ACTIVE' | 'HIDDEN' | 'UNAVAILABLE' | 'EXPIRED'>('all');

  constructor(
    private announcementsService: AdminAnnouncementsService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadAnnouncements();
  }

  loadAnnouncements(): void {
    this.isLoading.set(true);
    this.announcementsService.getAllAnnouncements().subscribe({
      next: (data: any) => {
        // Handle different response formats
        let announcements: Announcement[] = [];
        if (Array.isArray(data)) {
          announcements = data;
        } else if (data && typeof data === 'object') {
          // If data is wrapped in an object, try common property names
          announcements = data.announcements || data.data || data.result || [];
        }
        this.announcements.set(announcements);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading announcements', err);
        this.isLoading.set(false);
      }
    });
  }

  get filteredAnnouncements(): Announcement[] {
    let filtered = this.announcements();

    if (this.filterStatus() !== 'all') {
      filtered = filtered.filter(a => a.status === this.filterStatus());
    }

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        a.locationAddr.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  hideAnnouncement(id: string): void {
    this.announcementsService.updateAnnouncementStatus(id, 'HIDDEN').subscribe({
      next: () => this.loadAnnouncements(),
      error: (err: any) => {
        this.logger.error('Error hiding announcement', err);
        alert('Error hiding announcement');
      }
    });
  }

  showAnnouncement(id: string): void {
    this.announcementsService.updateAnnouncementStatus(id, 'ACTIVE').subscribe({
      next: () => this.loadAnnouncements(),
      error: (err: any) => {
        this.logger.error('Error showing announcement', err);
        alert('Error showing announcement');
      }
    });
  }

  deleteAnnouncement(id: string): void {
    this.announcementsService.deleteAnnouncement(id).subscribe({
      next: () => this.loadAnnouncements(),
      error: (err: any) => {
        this.logger.error('Error deleting announcement', err);
        alert('Error deleting announcement');
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'ACTIVE': 'badge-success',
      'HIDDEN': 'badge-secondary',
      'UNAVAILABLE': 'badge-warning',
      'EXPIRED': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'ACTIVE': 'Active',
      'HIDDEN': 'Hidden',
      'UNAVAILABLE': 'Unavailable',
      'EXPIRED': 'Expired'
    };
    return labels[status] || status;
  }
}

