/**
 * Mock data for Dashboard + Notifications + Homepage Leaderboard (without GraphQL backend).
 *
 * - `true` : affiche toujours les mocks (démo / UI).
 * - `false` : appelle l’API réelle uniquement.
 *
 * Override au runtime (console navigateur) :
 *   localStorage.setItem('MW_USE_MOCK', '1');  // mock
 *   localStorage.setItem('MW_USE_MOCK', '0');  // API réelle
 *   location.reload();
 */
export const MW_USE_MOCK_DASHBOARD_NOTIFICATIONS = false;

export function useMockDashboardNotifications(): boolean {
  if (typeof localStorage === 'undefined') {
    return MW_USE_MOCK_DASHBOARD_NOTIFICATIONS;
  }
  const v = localStorage.getItem('MW_USE_MOCK');
  if (v === '1') return true;
  if (v === '0') return false;
  return MW_USE_MOCK_DASHBOARD_NOTIFICATIONS;
}
