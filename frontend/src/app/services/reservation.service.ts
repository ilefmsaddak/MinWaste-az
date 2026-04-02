import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { FirebaseAuthService } from '../core/auth/firebase-auth.service';

const CREATE_RESERVATION = gql`
  mutation CreateReservation($itemId: String!, $quantity: Int!) {
    createReservation(itemId: $itemId, quantity: $quantity)
  }
`;

const CANCEL_RESERVATION = gql`
  mutation CancelReservation($transactionId: String!, $reason: String) {
    cancelReservation(transactionId: $transactionId, reason: $reason)
  }
`;

const CONFIRM_DONATION = gql`
  mutation ConfirmDonation($transactionId: String!) {
    confirmDonationTransaction(transactionId: $transactionId)
  }
`;

const CONFIRM_SALE = gql`
  mutation ConfirmSale($transactionId: String!) {
    confirmSaleTransaction(transactionId: $transactionId)
  }
`;

const COMPLETE_TRANSACTION = gql`
  mutation CompleteTransaction($transactionId: String!) {
    completeTransaction(transactionId: $transactionId)
  }
`;

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  constructor(
    private apollo: Apollo,
    private auth: FirebaseAuthService,
  ) {}

  private async getAuthHeaders() {
    const token = await this.auth.getValidIdToken();
    return {
      Authorization: `Bearer ${token}`,
    } as any;
  }

  async createReservation(itemId: string, quantity: number = 1): Promise<string> {
    const headers = await this.getAuthHeaders();
    
    const result = await firstValueFrom(
      this.apollo.mutate<{ createReservation: string }>({
        mutation: CREATE_RESERVATION,
        variables: { itemId, quantity },
        context: { headers },
      })
    );

    if (!result.data?.createReservation) {
      throw new Error('Failed to create reservation');
    }

    return result.data.createReservation;
  }

  async cancelReservation(transactionId: string, reason?: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    
    const result = await firstValueFrom(
      this.apollo.mutate<{ cancelReservation: boolean }>({
        mutation: CANCEL_RESERVATION,
        variables: { transactionId, reason },
        context: { headers },
      })
    );

    return result.data?.cancelReservation ?? false;
  }

  async confirmDonation(transactionId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    
    const result = await firstValueFrom(
      this.apollo.mutate<{ confirmDonationTransaction: boolean }>({
        mutation: CONFIRM_DONATION,
        variables: { transactionId },
        context: { headers },
      })
    );

    return result.data?.confirmDonationTransaction ?? false;
  }

  async confirmSale(transactionId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    
    const result = await firstValueFrom(
      this.apollo.mutate<{ confirmSaleTransaction: boolean }>({
        mutation: CONFIRM_SALE,
        variables: { transactionId },
        context: { headers },
      })
    );

    return result.data?.confirmSaleTransaction ?? false;
  }

  async completeTransaction(transactionId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    
    const result = await firstValueFrom(
      this.apollo.mutate<{ completeTransaction: boolean }>({
        mutation: COMPLETE_TRANSACTION,
        variables: { transactionId },
        context: { headers },
      })
    );

    return result.data?.completeTransaction ?? false;
  }
}
