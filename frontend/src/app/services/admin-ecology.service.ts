import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface EcologyMetric {
  id: string;
  name: string;
  description: string;
  icon: string;
  value: number;
  unit: string;
  trend: number; // percentage change
  color: string;
}

export interface IntervalData {
  period: string;
  co2Saved: number;
  foodSaved: number;
  waterSaved: number;
  wasteReduced: number;
  energySaved: number;
}

export interface EcologyReport {
  id: string;
  title: string;
  generatedDate: Date;
  period: string;
  metrics: EcologyMetric[];
  summary: string;
  recommendations: string[];
}

// Mock data
const MOCK_ECOLOGY_METRICS: EcologyMetric[] = [
  {
    id: '1',
    name: 'CO2 Emissions Saved',
    description: 'Total CO2 prevented from entering atmosphere',
    icon: '🌍',
    value: 1250,
    unit: 'kg CO2',
    trend: 12.5,
    color: '#667eea'
  },
  {
    id: '2',
    name: 'Food Waste Prevented',
    description: 'Total food items saved from landfill',
    icon: '🍎',
    value: 3840,
    unit: 'kg',
    trend: 8.3,
    color: '#764ba2'
  },
  {
    id: '3',
    name: 'Water Conserved',
    description: 'Water saved through item reuse',
    icon: '💧',
    value: 89500,
    unit: 'liters',
    trend: 15.2,
    color: '#f093fb'
  },
  {
    id: '4',
    name: 'Energy Consumption Reduced',
    description: 'Energy saved by avoiding new production',
    icon: '⚡',
    value: 4200,
    unit: 'kWh',
    trend: 9.7,
    color: '#4facfe'
  },
  {
    id: '5',
    name: 'Landfill Diversion',
    description: 'Items kept out of landfills',
    icon: '♻️',
    value: 8950,
    unit: 'kg',
    trend: 18.5,
    color: '#43e97b'
  },
  {
    id: '6',
    name: 'Tree Equivalent Planted',
    description: 'Equivalent trees that would absorb saved CO2',
    icon: '🌲',
    value: 185,
    unit: 'trees',
    trend: 11.2,
    color: '#38f9d7'
  }
];

const MOCK_MONTHLY_DATA: IntervalData[] = [
  {
    period: 'January 2026',
    co2Saved: 850,
    foodSaved: 2100,
    waterSaved: 45000,
    wasteReduced: 3500,
    energySaved: 2100
  },
  {
    period: 'February 2026',
    co2Saved: 920,
    foodSaved: 2650,
    waterSaved: 52000,
    wasteReduced: 4200,
    energySaved: 2450
  },
  {
    period: 'March 2026',
    co2Saved: 1250,
    foodSaved: 3840,
    waterSaved: 89500,
    wasteReduced: 8950,
    energySaved: 4200
  }
];

@Injectable({
  providedIn: 'root'
})
export class AdminEcologyService {
  private metrics = signal<EcologyMetric[]>(MOCK_ECOLOGY_METRICS);
  private monthlyData = signal<IntervalData[]>(MOCK_MONTHLY_DATA);
  private reports = signal<EcologyReport[]>([]);

  constructor(private http: HttpClient) {}

  // Get all metrics
  getEcologyMetrics(): Observable<EcologyMetric[]> {
    return of([...MOCK_ECOLOGY_METRICS]).pipe(delay(500));
  }

  // Get monthly data
  getMonthlyData(): Observable<IntervalData[]> {
    return of([...MOCK_MONTHLY_DATA]).pipe(delay(600));
  }

  // Get total statistics
  getTotalStats(): Observable<any> {
    return of({
      totalCo2Saved: 3020,
      totalFoodSaved: 8590,
      totalWaterSaved: 186500,
      totalWasteReduced: 16650,
      totalEnergySaved: 8750,
      totalUsers: 10,
      totalTransactions: 142,
      activeCampaigns: 5
    }).pipe(delay(400));
  }

  // Generate ecology report
  generateReport(period: string): void {
    const totalCo2 = MOCK_MONTHLY_DATA.reduce((sum, m) => sum + m.co2Saved, 0);
    const totalFood = MOCK_MONTHLY_DATA.reduce((sum, m) => sum + m.foodSaved, 0);
    const totalWater = MOCK_MONTHLY_DATA.reduce((sum, m) => sum + m.waterSaved, 0);

    const report: EcologyReport = {
      id: Date.now().toString(),
      title: `Ecology Impact Report - ${period}`,
      generatedDate: new Date(),
      period: period,
      metrics: MOCK_ECOLOGY_METRICS,
      summary: `During ${period}, our community achieved significant environmental impact. 
        Total CO2 saved: ${totalCo2} kg, preventing equivalent of ${Math.round(totalCo2 / 21)} tree-years of carbon absorption. 
        Food waste reduction: ${totalFood} kg contributed to circular economy. 
        Water conservation reached ${totalWater} liters through responsible item reuse.`,
      recommendations: [
        'Continue promoting electronics recycling - High impact on CO2reduction',
        'Expand food sharing network - Increase food waste prevention',
        'Implement seasonal campaigns focused on high water-saving items',
        'Partner with local NGOs for impact verification and reporting',
        'Develop gamification features to increase user engagement in ecology missions'
      ]
    };

    const currentReports = this.reports();
    this.reports.set([report, ...currentReports]);
  }

  // Get all reports
  getAllReports(): EcologyReport[] {
    return this.reports();
  }

  // Download report as PDF (mock)
  downloadReportPDF(reportId: string): void {
    const report = this.reports().find(r => r.id === reportId);
    if (report) {
      const content = this.formatReportContent(report);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.title.replace(/\s+/g, '_')}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
  }

  private formatReportContent(report: EcologyReport): string {
    let content = `
===========================================
        ECOLOGY IMPACT REPORT
===========================================

Title: ${report.title}
Generated: ${report.generatedDate.toLocaleDateString()}
Period: ${report.period}

ENVIRONMENTAL IMPACT METRICS:
-------------------------------------------
`;

    report.metrics.forEach(metric => {
      content += `
${metric.icon} ${metric.name}
   Value: ${metric.value} ${metric.unit}
   Trend: ${metric.trend > 0 ? '+' : ''}${metric.trend}%
   ${metric.description}
`;
    });

    content += `

SUMMARY:
-------------------------------------------
${report.summary}

RECOMMENDATIONS:
-------------------------------------------
`;

    report.recommendations.forEach((rec, index) => {
      content += `${index + 1}. ${rec}\n`;
    });

    content += `
===========================================
    Report Generated Automatically
===========================================
`;

    return content;
  }
}
