import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PAYMENT_GATEWAY, PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';
import { TransactionStatusService } from '../services/transaction-status.service';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    private readonly statuses: TransactionStatusService,
  ) {}

  async execute(id: string) {
    let transaction = await this.find(id);
    if (transaction.providerTransactionId && !this.statuses.isFinal(transaction.status)) {
      const provider = await this.gateway.getTransaction(transaction.providerTransactionId);
      await this.statuses.apply(id, provider);
      transaction = await this.find(id);
    }
    return transaction;
  }

  private async find(id: string) {
    const rows = await this.dataSource.query<Array<{
      id: string; reference: string; status: string; provider_transaction_id: string | null;
      provider_status: string | null; total_in_cents: string; currency: string;
      failure_reason: string | null; created_at: Date;
    }>>(
      `SELECT id, reference, status, provider_transaction_id, provider_status,
              total_in_cents, currency, failure_reason, created_at
       FROM transactions WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transacción no encontrada' });
    }
    const row = rows[0];
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      providerTransactionId: row.provider_transaction_id,
      providerStatus: row.provider_status,
      totalInCents: Number(row.total_in_cents),
      currency: row.currency,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
    };
  }
}
