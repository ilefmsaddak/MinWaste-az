import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminEcologyService, EcologyMetric, IntervalData, EcologyReport } from '../../services/admin-ecology.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-admin-ecology',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-ecology.html',
  styleUrl: './admin-ecology.scss'
})
export class AdminEcology implements OnInit {
  metrics = signal<EcologyMetric[]>([]);
  monthlyData = signal<IntervalData[]>([]);
  reports = signal<EcologyReport[]>([]);
  isLoading = signal(true);
  selectedPeriod = signal('All Data');
  showReportForm = signal(false);
  reportPeriod = signal('March 2026');

  // Statistics for dashboard
  totalCo2Saved = signal(0);
  totalFoodSaved = signal(0);
  totalWaterSaved = signal(0);
  totalWasteReduced = signal(0);
  totalEnergySaved = signal(0);
  totalUsers = signal(0);
  totalTransactions = signal(0);
  activeCampaigns = signal(0);

  selectedMetricForDetails = signal<EcologyMetric | null>(null);

  constructor(
    private ecologyService: AdminEcologyService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadEcologyData();
  }

  loadEcologyData(): void {
    this.isLoading.set(true);
    
    this.ecologyService.getEcologyMetrics().subscribe({
      next: (data: EcologyMetric[]) => {
        this.metrics.set(data);
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading metrics', err);
        this.isLoading.set(false);
      }
    });

    this.ecologyService.getMonthlyData().subscribe({
      next: (data: IntervalData[]) => {
        this.monthlyData.set(data);
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading monthly data', err);
      }
    });

    this.ecologyService.getTotalStats().subscribe({
      next: (stats: any) => {
        this.totalCo2Saved.set(stats.totalCo2Saved);
        this.totalFoodSaved.set(stats.totalFoodSaved);
        this.totalWaterSaved.set(stats.totalWaterSaved);
        this.totalWasteReduced.set(stats.totalWasteReduced);
        this.totalEnergySaved.set(stats.totalEnergySaved);
        this.totalUsers.set(stats.totalUsers);
        this.totalTransactions.set(stats.totalTransactions);
        this.activeCampaigns.set(stats.activeCampaigns);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.logger.logApiError('Error loading stats', err);
        this.isLoading.set(false);
      }
    });

    // Load existing reports
    this.reports.set(this.ecologyService.getAllReports());
  }

  generateReport(): void {
    this.ecologyService.generateReport(this.reportPeriod());
    this.reports.set(this.ecologyService.getAllReports());
    this.showReportForm.set(false);
  }

  downloadReport(reportId: string): void {
    this.ecologyService.downloadReportPDF(reportId);
  }

  deleteReport(reportId: string): void {
    this.reports.set(this.reports().filter(r => r.id !== reportId));
  }

  viewMetricDetails(metric: EcologyMetric): void {
    this.selectedMetricForDetails.set(metric);
  }

  closeMetricDetails(): void {
    this.selectedMetricForDetails.set(null);
  }

  getTrendClass(trend: number): string {
    return trend > 0 ? 'trend-positive' : trend < 0 ? 'trend-negative' : 'trend-neutral';
  }

  getTrendIcon(trend: number): string {
    return trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
  }
}
