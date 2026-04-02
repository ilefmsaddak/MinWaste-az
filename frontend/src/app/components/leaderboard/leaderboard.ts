import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { useMockDashboardNotifications } from '../../core/mock/mock-data.config';
import { getMockDashboardData } from '../../core/mock/dashboard-mock.data';

/** Real data from backend (no more static mock list). */
const HOME_LEADERBOARD = gql`
  query HomeLeaderboard {
    myDashboard {
      points
      level
      levelLabel
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
    }
  }
`;

export interface LeaderboardRow {
  key: string;
  rank: number;
  name: string;
  level: number;
  score: number;
  isCurrentUser?: boolean;
}

@Component({
  selector: 'app-leaderboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
  standalone: true,
})
export class Leaderboard implements OnInit {
  users = signal<LeaderboardRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  /** Summary "you" (global rank, points, level) */
  summary = signal<{
    myRank: number;
    myPoints: number;
    level: number;
    levelLabel: string;
  } | null>(null);

  constructor(private readonly apollo: Apollo) {}

  ngOnInit(): void {
    if (useMockDashboardNotifications()) {
      const mock = getMockDashboardData('MONTH');
      const lb = mock.leaderboard;
      const myRank = lb.myRank ?? 0;
      this.summary.set({
        myRank,
        myPoints: lb.myPoints ?? 0,
        level: mock.level ?? 1,
        levelLabel: mock.levelLabel ?? '',
      });
      const rows: LeaderboardRow[] = (lb.top ?? []).map((e, i) => ({
        key: `${e.rank}-${e.displayName ?? 'user'}-${i}`,
        rank: e.rank,
        name: e.displayName ?? '—',
        level: e.level,
        score: e.points,
        isCurrentUser: e.rank === myRank,
      }));
      this.users.set(rows);
      this.error.set(null);
      this.loading.set(false);
      return;
    }

    this.apollo
      .query({
        query: HOME_LEADERBOARD,
        fetchPolicy: 'network-only',
      })
      .subscribe({
        next: (r: any) => {
          const d = r.data?.myDashboard;
          if (!d?.leaderboard) {
            this.error.set('Data unavailable');
            this.loading.set(false);
            return;
          }
          const lb = d.leaderboard;
          const myRank = lb.myRank ?? 0;
          this.summary.set({
            myRank,
            myPoints: lb.myPoints ?? 0,
            level: d.level ?? 1,
            levelLabel: d.levelLabel ?? '',
          });
          const rows: LeaderboardRow[] = (lb.top ?? []).map((e: any, i: number) => ({
            key: `${e.rank}-${e.displayName ?? 'user'}-${i}`,
            rank: e.rank,
            name: e.displayName ?? '—',
            level: e.level,
            score: e.points,
            isCurrentUser: e.rank === myRank,
          }));
          this.users.set(rows);
          this.error.set(null);
          this.loading.set(false);
        },
        error: (e: any) => {
          this.error.set(
            e?.message ??
              'Unable to load leaderboard (is backend running on port 4000?)',
          );
          this.loading.set(false);
          this.users.set([]);
          this.summary.set(null);
        },
      });
  }

  initial(name: string): string {
    const c = (name ?? '?').trim().charAt(0);
    return c ? c.toUpperCase() : '?';
  }
}
