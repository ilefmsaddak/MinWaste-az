export type DashboardSeriesPeriod = 'WEEK' | 'MONTH' | 'YEAR';

/** Données fictives alignées sur le template `dashboard.html` / `myDashboard` GraphQL */
export function getMockDashboardData(pointsSeriesPeriod: DashboardSeriesPeriod) {
  const monthlySeries = [
    { period: '2025-10', kgCo2: 2.1, moneySavedTnd: 12.5 },
    { period: '2025-11', kgCo2: 3.4, moneySavedTnd: 18.0 },
    { period: '2025-12', kgCo2: 4.2, moneySavedTnd: 22.3 },
    { period: '2026-01', kgCo2: 5.1, moneySavedTnd: 28.0 },
    { period: '2026-02', kgCo2: 4.8, moneySavedTnd: 25.5 },
    { period: '2026-03', kgCo2: 6.2, moneySavedTnd: 31.2 },
  ];

  let pointsSeries: { period: string; points: number }[];
  if (pointsSeriesPeriod === 'WEEK') {
    const base = new Date();
    pointsSeries = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (6 - i));
      return {
        period: d.toISOString().slice(0, 10),
        points: [2, 5, 0, 8, 3, 12, 7][i] ?? 1,
      };
    });
  } else if (pointsSeriesPeriod === 'YEAR') {
    pointsSeries = [
      { period: '2025-04', points: 40 },
      { period: '2025-05', points: 55 },
      { period: '2025-06', points: 48 },
      { period: '2025-07', points: 62 },
      { period: '2025-08', points: 70 },
      { period: '2025-09', points: 65 },
      { period: '2025-10', points: 80 },
      { period: '2025-11', points: 90 },
      { period: '2025-12', points: 95 },
      { period: '2026-01', points: 100 },
      { period: '2026-02', points: 88 },
      { period: '2026-03', points: 102 },
    ];
  } else {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() - 29);
    base.setUTCHours(0, 0, 0, 0);
    const t0 = base.getTime();
    const dayMs = 86400000;
    pointsSeries = Array.from({ length: 30 }, (_, i) => ({
      period: new Date(t0 + i * dayMs).toISOString().slice(0, 10),
      points: (i % 7) + (i % 3) * 2,
    }));
  }

  return {
    points: 1280,
    level: 13,
    levelLabel: 'Engagé',
    pointsToday: 25,
    foodKgRescuedToday: 3.5,
    totalKgCo2Avoided: 42.8,
    totalMoneySavedTnd: 156.4,
    transactionsCompleted: 24,
    donationsAsOwner: 14,
    salesAsOwner: 4,
    monthlySeries,
    pointsSeries,
    community: {
      avgKgCo2PerUser: 18.5,
      yourKgCo2: 42.8,
      deltaVsAvgPercent: 131.4,
    },
    leaderboard: {
      top: [
        { rank: 1, displayName: 'Samira K.', points: 9820, level: 50 },
        { rank: 2, displayName: 'Ahmed B.', points: 8754, level: 48 },
        { rank: 3, displayName: 'Lina M.', points: 8012, level: 45 },
        { rank: 4, displayName: 'Youssef T.', points: 7650, level: 44 },
        { rank: 5, displayName: 'Nour H.', points: 7201, level: 42 },
      ],
      myRank: 42,
      myPoints: 1280,
    },
    leaderboardCity: {
      top: [
        { rank: 1, displayName: 'Samira K.', points: 9820, level: 50 },
        { rank: 2, displayName: 'Toi (démo)', points: 1280, level: 13 },
        { rank: 3, displayName: 'Karim L.', points: 1100, level: 12 },
      ],
      myRank: 2,
      myPoints: 1280,
      cityLabel: 'Tunis',
    },
  };
}
