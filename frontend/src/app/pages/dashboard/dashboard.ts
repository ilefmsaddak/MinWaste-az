import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo, gql } from 'apollo-angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { filter, timeout, take } from 'rxjs/operators';
import { TimeoutError, firstValueFrom } from 'rxjs';

export type DashboardSeriesPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';

function formatDashboardError(e: unknown): string {
  if (!e) return 'Unknown error';
  if (e instanceof TimeoutError) {
    return 'Timeout: server not responding. Verify that the Nest backend is running on http://localhost:4000';
  }
  const anyE = e as {
    message?: string;
    graphQLErrors?: { message?: string }[];
    networkError?: { message?: string; statusCode?: number };
  };
  const gqlMsgs = anyE.graphQLErrors?.map((x) => x?.message).filter(Boolean);
  if (gqlMsgs?.length) return gqlMsgs.join(' · ');
  if (anyE.networkError?.message) return anyE.networkError.message;
  if (typeof anyE.message === 'string') return anyE.message;
  return 'Unable to load dashboard (GraphQL).';
}

const MY_DASHBOARD = gql`
  query MyDashboard($pointsSeriesPeriod: DashboardSeriesPeriod) {
    myDashboard(pointsSeriesPeriod: $pointsSeriesPeriod) {
      timezoneLabel
      points
      level
      levelLabel
      pointsToday
      pointsToNextLevel
      nextLevelPoints
      levelProgressPct
      foodKgRescued
      itemsExchanged
      totalKgCo2Avoided
      totalMoneySavedTnd
      transactionsCompleted
      donationsAsDonor
      donationsAsReceiver
      salesAsSeller
      purchasesAsBuyer
      kpiDeltas {
        metric
        currentValue
        previousValue
        deltaPercent
      }
      monthlyCo2Series {
        period
        kgCo2
        moneySavedTnd
      }
      pointsSeries {
        period
        points
      }
      community {
        avgKgCo2PerUser
        yourKgCo2
        deltaVsAvgPercent
        percentile
        activeUsersCount
        monthPoints
        avgMonthPointsPerActiveUser
        monthPointsDeltaPercent
        definition
      }
      leaderboard {
        top {
          rank
          displayName
          points
          level
        }
        myRank
        myPoints
      }
      leaderboardCity {
        top {
          rank
          displayName
          points
          level
        }
        myRank
        myPoints
        cityLabel
      }
      recentBadges {
        code
        name
        earnedAt
      }
      recentPointsGains {
        delta
        actionCode
        createdAt
      }
    }
  }
`;

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPage implements OnInit {
  loading = true;
  error: string | null = null;
  data: any = null;
  skeletonRows = Array.from({ length: 8 }, (_, i) => i);
  seriesPeriod: DashboardSeriesPeriod = 'MONTH';
  readonly periodOptions: { label: string; value: DashboardSeriesPeriod }[] = [
    { label: '7 jours', value: 'WEEK' },
    { label: '30 jours', value: 'MONTH' },
    { label: '12 mois', value: 'YEAR' },
    { label: 'Tout', value: 'ALL' },
  ];

  private readonly apiBase = 'http://localhost:4000';

  constructor(
    private apollo: Apollo,
    private auth: FirebaseAuthService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  private async ensureToken(): Promise<string | null> {
    await firstValueFrom(
      this.auth.authReady$.pipe(filter(Boolean), take(1), timeout(6000)),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    return this.auth.getIdToken();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;
    this.data = null;

    void this.loadDashboardFromApi();
  }

  private async queryDashboard(token: string): Promise<any> {
    return firstValueFrom(
      this.apollo
        .query({
          query: MY_DASHBOARD,
          variables: { pointsSeriesPeriod: this.seriesPeriod },
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
          context: {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        })
        .pipe(timeout(25000)),
    );
  }

  private async loadDashboardFromApi(): Promise<void> {
    let token: string | null;
    try {
      token = await this.ensureToken();
    } catch {
      this.loading = false;
      this.error =
        'Session non prete. Reessayez dans quelques secondes ou reconnectez-vous.';
      this.cdr.markForCheck();
      return;
    }

    if (!token) {
      this.loading = false;
      this.error =
        'Token d\'authentification introuvable. Veuillez vous reconnecter.';
      this.cdr.markForCheck();
      return;
    }

    try {
      let r: any = await this.queryDashboard(token);

      const firstErrors = r?.errors;
      const firstData = r?.data?.myDashboard ?? null;

      const shouldRetry =
        !firstData ||
        (Array.isArray(firstErrors) &&
          firstErrors.some((x: { message?: string }) =>
            /unauthorized|forbidden|auth|token/i.test(String(x?.message ?? '')),
          ));

      if (shouldRetry) {
        const freshToken = await this.auth.getValidIdToken();
        r = await this.queryDashboard(freshToken);
      }

      const gqlErrs = r?.errors;
      if (gqlErrs?.length) {
        this.error = gqlErrs
          .map((x: { message?: string }) => x?.message)
          .filter(Boolean)
          .join(' · ');
        this.data = r?.data?.myDashboard ?? null;
        this.cdr.markForCheck();
        return;
      }

      this.data = r?.data?.myDashboard ?? null;
      if (!this.data) {
        this.error =
          'Empty response: verify the connection and that http://localhost:4000/graphql is responding.';
      }
      this.cdr.markForCheck();
    } catch (e: unknown) {
      this.error = formatDashboardError(e);
      this.data = null;
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  setSeriesPeriod(p: DashboardSeriesPeriod): void {
    if (this.seriesPeriod === p) return;
    this.seriesPeriod = p;
    this.loadDashboard();
  }

  /**
   * Même structure que `DashboardService.buildCsvExport` (backend).
   */
  async exportCsv(): Promise<void> {
    if (!this.data) {
      alert('Aucune donnée à exporter. Chargez d’abord le dashboard.');
      return;
    }

    const token = await this.auth.getIdToken();
    if (!token) {
      alert('Connexion requise pour exporter les données.');
      return;
    }
    const url = `${this.apiBase}/api/dashboard/export.csv?period=${this.seriesPeriod}`;
    this.http
      .get(url, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'minwaste-dashboard.csv';
          a.click();
          URL.revokeObjectURL(a.href);
        },
        error: () => {
          alert(
            'Export impossible. Vérifiez que le backend est démarré sur le port 4000.',
          );
        },
      });
  }

  maxKgSeries(): number {
    const s = this.data?.monthlyCo2Series ?? [];
    if (!s.length) return 1;
    return Math.max(1, ...s.map((x: any) => x.kgCo2 ?? 0));
  }

  maxPointsSeries(): number {
    const s = this.data?.pointsSeries ?? [];
    if (!s.length) return 1;
    return Math.max(1, ...s.map((x: any) => x.points ?? 0));
  }

  kpiDelta(metric: string): number | null {
    const row = this.data?.kpiDeltas?.find((k: any) => k.metric === metric);
    if (!row || row.deltaPercent == null) return null;
    return Number(row.deltaPercent);
  }

  formatDelta(metric: string): string {
    const d = this.kpiDelta(metric);
    if (d == null) return 'n/a';
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}%`;
  }

  deltaClass(metric: string): string {
    const d = this.kpiDelta(metric);
    if (d == null) return 'neutral';
    return d >= 0 ? 'positive' : 'negative';
  }

  pointsChartTitle(): string {
    if (this.seriesPeriod === 'WEEK') return 'Points gagnés (7 jours)';
    if (this.seriesPeriod === 'MONTH') return 'Points gagnés (30 jours)';
    if (this.seriesPeriod === 'YEAR') return 'Points gagnés (12 mois)';
    return 'Points gagnés (historique complet)';
  }

  shortPeriodLabel(period: string): string {
    if (!period) return '';
    if (period.length === 10) {
      return period.slice(5);
    }
    return period;
  }

  toPercent(value: number, max: number): number {
    if (!max || max <= 0) return 0;
    return Math.max(0, Math.min(100, (value / max) * 100));
  }

  top3(): any[] {
    return (this.data?.leaderboard?.top ?? []).slice(0, 3);
  }

  next2(): any[] {
    return (this.data?.leaderboard?.top ?? []).slice(3, 5);
  }

  rowKey(entry: any, index: number, scope: string): string {
    return `${scope}-${entry?.rank ?? 'x'}-${entry?.displayName ?? 'user'}-${index}`;
  }

  hasNoTransactions(): boolean {
    return (this.data?.transactionsCompleted ?? 0) === 0;
  }

  goToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  goToBuy(): void {
    this.router.navigate(['/buy']);
  }

  goToProfile(): void {
    this.router.navigate(['/profile/edit']);
  }
}
