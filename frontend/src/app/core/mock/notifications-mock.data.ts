export interface MockNotification {
  id: string;
  type: string;
  title: string | null;
  body: string;
  isRead: boolean;
  payload?: string;
  createdAt: string;
}

export function createMockNotifications(): MockNotification[] {
  const now = Date.now();
  return [
    {
      id: 'mock-1',
      type: 'BADGE_EARNED',
      title: '🏅 New badge',
      body: 'You unlocked: First Donation',
      isRead: false,
      createdAt: new Date(now - 3600000).toISOString(),
    },
    {
      id: 'mock-2',
      type: 'PICKUP_CONFIRMED',
      title: 'Transaction terminée',
      body: '+points gagnés (don) — MinWaste',
      isRead: false,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'mock-3',
      type: 'RESERVATION_CREATED',
      title: 'Réservation',
      body: 'Quelqu’un est intéressé par votre annonce « Panier légumes ».',
      isRead: true,
      createdAt: new Date(now - 86400000 * 5).toISOString(),
    },
    {
      id: 'mock-4',
      type: 'MESSAGE_RECEIVED',
      title: 'Nouveau message',
      body: 'Salut, je peux passer récupérer demain 18h ?',
      isRead: true,
      createdAt: new Date(now - 86400000 * 7).toISOString(),
    },
  ];
}
