import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateBadgeFormComponent } from '../../components/create-badge-form/create-badge-form';
import { EditBadgeFormComponent } from '../../components/edit-badge-form/edit-badge-form';
import { DeleteConfirmationDialogComponent } from '../../components/delete-confirmation-dialog/delete-confirmation-dialog';
import { BadgeAdminService, Badge } from '../../services/badge-admin.service';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { LoggerService } from '../../services/logger.service';

// Use LeaderboardEntry from service instead of local interface
type Leaderboard = LeaderboardEntry;



@Component({
  selector: 'app-admin-gamification',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateBadgeFormComponent, EditBadgeFormComponent, DeleteConfirmationDialogComponent],
  templateUrl: './admin-gamification.html',
  styleUrl: './admin-gamification.scss'
})
export class AdminGamification implements OnInit {
  badges = signal<Badge[]>([]);
  leaderboard = signal<Leaderboard[]>([]);
  isLoading = signal(true);
  totalPoints = signal(0);
  averagePoints = signal(0);
  activeTab = signal<'badges' | 'leaderboard'>('badges');
  showCreateBadgeForm = signal(false);
  showEditBadgeForm = signal(false);
  selectedBadgeForEdit = signal<Badge | null>(null);
  showDeleteConfirmation = signal(false);
  badgeToDelete = signal<Badge | null>(null);

  constructor(
    private badgeService: BadgeAdminService,
    private leaderboardService: LeaderboardService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadGamificationData();
  }

  loadGamificationData(): void {
    this.isLoading.set(true);
    
    // Fetch badges from backend
    this.badgeService.getAllBadges().subscribe({
      next: (badges) => {
        this.badges.set(badges);
        this.loadLeaderboardData();
      },
      error: (error) => {
        this.logger.logApiError('Failed to load badges', error);
        // No fallback - show empty state if backend fails
        this.badges.set([]);
        this.isLoading.set(false);
      }
    });
  }

  loadLeaderboardData(): void {
    // Fetch leaderboard from backend
    this.leaderboardService.getLeaderboard().subscribe({
      next: (response: any) => {
        this.logger.logApiResponse('Leaderboard API Response', response);
        
        // Handle both response formats: array directly or { data: [...], total: ... }
        const leaderboardData = Array.isArray(response) ? response : response?.data || [];
        
        if (!leaderboardData || leaderboardData.length === 0) {
          this.logger.warn('Leaderboard is empty');
        }
        
        this.leaderboard.set(leaderboardData);
        
        // Calculate stats from fetched data
        const totalPoints = leaderboardData.reduce((sum: number, u: Leaderboard) => sum + u.points, 0);
        const avgPoints = leaderboardData.length > 0 ? Math.round(totalPoints / leaderboardData.length) : 0;
        
        this.totalPoints.set(totalPoints);
        this.averagePoints.set(avgPoints);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.logger.logApiError('Failed to load leaderboard', error);
        // No fallback - show empty state if backend fails
        this.leaderboard.set([]);
        this.totalPoints.set(0);
        this.averagePoints.set(0);
        this.isLoading.set(false);
      }
    });
  }

  setTab(tab: 'badges' | 'leaderboard'): void {
    this.activeTab.set(tab);
  }

  deleteBadge(id: string): void {
    const badge = this.badges().find(b => b.id === id);
    if (badge) {
      this.badgeToDelete.set(badge);
      this.showDeleteConfirmation.set(true);
    }
  }

  onDeleteConfirmed(): void {
    const badge = this.badgeToDelete();
    if (badge) {
      this.badgeService.deleteBadge(badge.id).subscribe({
        next: () => {
          this.badges.set(this.badges().filter(b => b.id !== badge.id));
          this.showDeleteConfirmation.set(false);
          this.badgeToDelete.set(null);
        },
        error: (error) => {
          this.logger.error('Failed to delete badge', error);
          alert('Failed to delete badge');
          this.showDeleteConfirmation.set(false);
          this.badgeToDelete.set(null);
        }
      });
    }
  }

  onDeleteCancelled(): void {
    this.showDeleteConfirmation.set(false);
    this.badgeToDelete.set(null);
  }

  editBadge(id: string): void {
    const badge = this.badges().find(b => b.id === id);
    if (badge) {
      this.selectedBadgeForEdit.set(badge);
      this.showEditBadgeForm.set(true);
    }
  }

  openCreateBadgeForm(): void {
    this.showCreateBadgeForm.set(true);
  }

  closeCreateBadgeForm(): void {
    this.showCreateBadgeForm.set(false);
  }

  onBadgeCreated(): void {
    this.loadGamificationData();
  }

  closeEditBadgeForm(): void {
    this.showEditBadgeForm.set(false);
    this.selectedBadgeForEdit.set(null);
  }

  onBadgeUpdated(): void {
    this.loadGamificationData();
  }
}
