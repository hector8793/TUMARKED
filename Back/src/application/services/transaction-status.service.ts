import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { GatewayTransaction } from '../../domain/ports/payment-gateway.port';

const FINAL_STATUSES = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);
const KNOWN_STATUSES = new Set(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);

@Injectable()
export class TransactionStatusService {
  constructor(private readonly dataSource: DataSource) {}

  normalize(status: string): string {
    const normalized = status.toUpperCase();
    return KNOWN_STATUSES.has(normalized) ? normalized : 'ERROR';
  }

  isFinal(status: string): boolean {
    return FINAL_STATUSES.has(status);
  }

  async apply(localTransactionId: string, provider: GatewayTransaction): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<Array<{
        id: string; status: string; delivery_id: string; stock_applied: boolean;
      }>>(
        'SELECT id, status, delivery_id, stock_applied FROM transactions WHERE id = $1 FOR UPDATE',
        [localTransactionId],
      );
      const current = rows[0];
      if (!current) return;

      const nextStatus = this.normalize(provider.status);
      if (current.status === nextStatus && (nextStatus !== 'APPROVED' || current.stock_applied)) return;

      await manager.query(
        `UPDATE transactions SET
           status = $2::transaction_status,
           provider_transaction_id = COALESCE(provider_transaction_id, $3),
           provider_status = $4,
           payment_method_type = COALESCE($5, payment_method_type),
           failure_reason = CASE WHEN $2 IN ('DECLINED', 'ERROR') THEN $6 ELSE NULL END,
           processed_at = CASE WHEN $2 IN ('APPROVED','DECLINED','VOIDED','ERROR') THEN NOW() ELSE processed_at END,
           approved_at = CASE WHEN $2 = 'APPROVED' THEN NOW() ELSE approved_at END,
           declined_at = CASE WHEN $2 = 'DECLINED' THEN NOW() ELSE declined_at END
         WHERE id = $1`,
        [
          localTransactionId, nextStatus, provider.id, provider.status,
          provider.paymentMethodType ?? null, provider.statusMessage ?? null,
        ],
      );
      await manager.query(
        `INSERT INTO transaction_status_history
           (transaction_id, previous_status, new_status, source, reason)
         VALUES ($1, $2::transaction_status, $3::transaction_status, 'PAYMENT_PROVIDER', $4)`,
        [localTransactionId, current.status, nextStatus, provider.statusMessage ?? null],
      );

      if (nextStatus === 'APPROVED') {
        await this.confirmApprovedTransaction(manager, localTransactionId, current.delivery_id);
      }
    });
  }

  private async confirmApprovedTransaction(
    manager: EntityManager,
    transactionId: string,
    deliveryId: string,
  ): Promise<void> {
    const items = await manager.query<Array<{ product_id: string; quantity: number }>>(
      'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1',
      [transactionId],
    );
    for (const item of items) {
      await manager.query('SELECT apply_approved_sale_stock($1, $2, $3)', [
        transactionId, item.product_id, item.quantity,
      ]);
    }
    await manager.query(
      `UPDATE deliveries SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, NOW())
       WHERE id = $1 AND status = 'PENDING'`,
      [deliveryId],
    );
    await manager.query(
      'UPDATE transactions SET delivery_confirmed = TRUE WHERE id = $1',
      [transactionId],
    );
  }
}
