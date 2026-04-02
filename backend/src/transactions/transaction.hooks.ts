import { Injectable, Logger } from '@nestjs/common';
import { EcologyService } from '../ecology/ecology.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class TransactionHooks {
  private readonly logger = new Logger(TransactionHooks.name);

  constructor(
    private readonly ecologyService: EcologyService,
    private readonly gamificationService: GamificationService,
  ) {}

  /**
   * Called when transaction status changes to finalized
   */
  async onTransactionFinalized(transactionId: string): Promise<void> {
    try {
      this.logger.log(`Processing finalized transaction: ${transactionId}`);

      // Calculate and save ecology impact
      await this.ecologyService.finalizeTransactionImpact(transactionId);

      // Award points and check badges
      await this.gamificationService.awardTransactionPoints(transactionId);

      this.logger.log(`Transaction processing completed: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Error processing transaction ${transactionId}:`, error);
      throw error;
    }
  }
}