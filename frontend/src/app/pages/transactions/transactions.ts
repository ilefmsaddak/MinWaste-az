import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { ReservationService } from '../../services/reservation.service';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';

interface Transaction {
  id: string;
  status: string;
  quantity: number;
  itemId: string;
  itemTitle: string;
  itemPrice: number;
  itemPriceType: string;
  ownerName: string;
  receiverName: string;
  ownerId: string;
  receiverId: string;
  createdAt: string;
  updatedAt: string;
}

const MY_TRANSACTIONS = gql`
  query MyTransactions {
    myTransactions {
      id
      status
      quantity
      item {
        id
        title
        price_amount
        price_type
        users {
          id
          display_name
        }
      }
      owner {
        id
        display_name
      }
      receiver {
        id
        display_name
      }
      created_at
      updated_at
    }
  }
`;

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, NavBar, FormsModule],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class TransactionsPage implements OnInit {
  activeTab = signal<'purchases' | 'received'>('purchases');
  isLoading = signal(false);
  error = signal<string | null>(null);
  transactions = signal<Transaction[]>([]);
  
  currentUserId: string | null = null;
  actionInProgress = signal<{ [txId: string]: boolean }>({});

  constructor(
    private auth: FirebaseAuthService,
    private reservationService: ReservationService,
    private apollo: Apollo,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.currentUserId = localStorage.getItem('userId');
    if (!this.currentUserId) {
      this.error.set('User not authenticated');
      return;
    }

    // Handle tab from query params
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'received' || tab === 'purchases') {
      this.activeTab.set(tab as 'received' | 'purchases');
    }

    this.loadTransactions();
  }

  async loadTransactions(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const token = await this.auth.getValidIdToken();
      const result = await firstValueFrom(
        this.apollo.query<{ myTransactions: any[] }>({
          query: MY_TRANSACTIONS,
          fetchPolicy: 'network-only',
          context: {
            headers: { Authorization: `Bearer ${token}` } as any,
          },
        })
      );

      const txs = result.data?.myTransactions ?? [];
      const mapped = txs.map((tx: any) => ({
        id: tx.id,
        status: tx.status,
        quantity: tx.quantity,
        itemId: tx.item?.id,
        itemTitle: tx.item?.title,
        itemPrice: tx.item?.price_amount ? Number(tx.item.price_amount) : 0,
        itemPriceType: tx.item?.price_type ?? 'FREE',
        ownerName: tx.owner?.display_name ?? 'Unknown',
        receiverName: tx.receiver?.display_name ?? 'Unknown',
        ownerId: tx.owner?.id,
        receiverId: tx.receiver?.id,
        createdAt: tx.created_at,
        updatedAt: tx.updated_at,
      }));

      this.transactions.set(mapped);
      this.isLoading.set(false);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      const gqlMessage =
        err?.graphQLErrors?.[0]?.message ??
        err?.error?.errors?.[0]?.message ??
        err?.networkError?.error?.errors?.[0]?.message ??
        err?.networkError?.result?.errors?.[0]?.message ??
        err?.error?.message ??
        err?.message;
      this.error.set(gqlMessage || 'Failed to load transactions');
      this.isLoading.set(false);
    }
  }

  getPurchases(): Transaction[] {
    return this.transactions().filter((tx) => tx.receiverId === this.currentUserId);
  }

  getReceived(): Transaction[] {
    return this.transactions().filter((tx) => tx.ownerId === this.currentUserId);
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      pending: '#f59e0b',
      confirmed_by_sender: '#3b82f6',
      completed: '#10b981',
      canceled: '#ef4444',
      expired: '#6b7280',
    };
    return colors[status.toLowerCase()] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending: 'Pending',
      confirmed_by_sender: 'Confirmed',
      completed: 'Completed',
      canceled: 'Canceled',
      expired: 'Expired',
    };
    return labels[status.toLowerCase()] || status;
  }

  canConfirm(tx: Transaction): boolean {
    return (
      tx.status === 'PENDING' &&
      tx.ownerId === this.currentUserId &&
      tx.itemPriceType !== 'FREE'
    );
  }

  canConfirmDonation(tx: Transaction): boolean {
    return (
      tx.status === 'PENDING' &&
      tx.ownerId === this.currentUserId &&
      tx.itemPriceType === 'FREE'
    );
  }

  canComplete(tx: Transaction): boolean {
    return (
      tx.status === 'CONFIRMED_BY_SENDER' &&
      tx.receiverId === this.currentUserId
    );
  }

  canCancel(tx: Transaction): boolean {
    if (tx.status !== 'PENDING' || tx.receiverId !== this.currentUserId) {
      return false;
    }
    const createdAt = new Date(tx.createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursElapsed <= 24;
  }

  getHoursUntilExpiry(tx: Transaction): number {
    if (tx.status !== 'PENDING') return 0;
    const createdAt = new Date(tx.createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.ceil(24 - hoursElapsed));
  }

  async confirmTransaction(tx: Transaction): Promise<void> {
    if (!confirm(`Confirm reservation for "${tx.itemTitle}"?`)) return;

    this.actionInProgress.update((a) => ({ ...a, [tx.id]: true }));

    try {
      if (tx.itemPriceType === 'FREE') {
        await this.reservationService.confirmDonation(tx.id);
      } else {
        await this.reservationService.confirmSale(tx.id);
      }
      alert('Transaction confirmed! Buyer will be notified.');
      await this.loadTransactions();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to confirm'}`);
    } finally {
      this.actionInProgress.update((a) => ({
        ...a,
        [tx.id]: false,
      }));
    }
  }

  async completeTransaction(tx: Transaction): Promise<void> {
    if (!confirm(`Complete transaction for "${tx.itemTitle}"?`)) return;

    this.actionInProgress.update((a) => ({ ...a, [tx.id]: true }));

    try {
      await this.reservationService.completeTransaction(tx.id);
      alert('Transaction completed! Item marked as received.');
      await this.loadTransactions();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to complete'}`);
    } finally {
      this.actionInProgress.update((a) => ({
        ...a,
        [tx.id]: false,
      }));
    }
  }

  async cancelTransaction(tx: Transaction): Promise<void> {
    const reason = prompt(
      'Why are you canceling? (optional)',
      'Decided not to proceed'
    );
    if (reason === null) return; // User clicked cancel

    this.actionInProgress.update((a) => ({ ...a, [tx.id]: true }));

    try {
      await this.reservationService.cancelReservation(tx.id, reason);
      alert('Reservation canceled. Item quantity restored.');
      await this.loadTransactions();
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to cancel'}`);
    } finally {
      this.actionInProgress.update((a) => ({
        ...a,
        [tx.id]: false,
      }));
    }
  }

  goToItem(itemId: string): void {
    this.router.navigate(['/annonce', itemId]);
  }
}
