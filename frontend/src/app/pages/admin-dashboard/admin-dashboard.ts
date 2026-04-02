import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminUserService } from '../../services/admin-user.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit {
  totalUsers = 0;
  activeUsers = 0;
  suspendedUsers = 0;
  totalAnnouncements = 0;
  recentActivity: any[] = [];
  isLoading = true;

  constructor(
    private adminUserService: AdminUserService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.adminUserService.getUsersStats().subscribe({
      next: (stats: any) => {
        this.totalUsers = stats.total || 0;
        this.activeUsers = stats.active || 0;
        this.suspendedUsers = stats.suspended || 0;
        this.totalAnnouncements = stats.announcements || 0;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading dashboard data', err);
        this.isLoading = false;
      }
    });
  }
}
