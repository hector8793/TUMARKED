import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { PaymentCryptoService } from '../services/payment-crypto.service';
import { TransactionStatusService } from '../services/transaction-status.service';

export interface PaymentEventPayload {
  event: string;
  data: Record<string, unknown> & {
    transaction?: {
      id?: string; reference?: string; status?: string; amount_in_cents?: number;
      status_message?: string; payment_method_type?: string;
    };
  };
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}

@Injectable()
export class HandlePaymentEventUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: PaymentCryptoService,
    private readonly statuses: TransactionStatusService,
  ) {}

  async execute(payload: PaymentEventPayload, headerChecksum?: string) {
    const checksum = headerChecksum || payload.signature?.checksum;
    if (!payload.data || !payload.signature?.properties || !payload.timestamp || !checksum) {
      throw new BadRequestException({ code: 'INVALID_EVENT', message: 'Evento incompleto' });
    }
    if (!this.crypto.verifyEvent(payload.data, payload.signature.properties, payload.timestamp, checksum)) {
      throw new UnauthorizedException({ code: 'INVALID_EVENT_SIGNATURE', message: 'Firma de evento inválida' });
    }
    if (payload.event !== 'transaction.updated' || !payload.data.transaction?.id) {
      return { received: true, processed: false };
    }

    const provider = payload.data.transaction;
    const providerId = provider.id as string;
    const localRows = await this.dataSource.query<Array<{ id: string; total_in_cents: string }>>(
      `SELECT id, total_in_cents FROM transactions
       WHERE provider_transaction_id = $1 OR reference = $2 LIMIT 1`,
      [providerId, provider.reference ?? null],
    );
    const local = localRows[0];
    const eventId = createHash('sha256')
      .update(`${payload.event}:${providerId}:${provider.status}:${payload.timestamp}`)
      .digest('hex');
    const [, insertedRows] = await this.dataSource.query<[Array<{ id: string }>, number]>(
      `INSERT INTO payment_events (
         provider_event_id, transaction_id, provider_transaction_id, event_type,
         signature_valid, payload, processed
       ) VALUES ($1, $2, $3, $4, TRUE, $5::jsonb, FALSE)
       ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
      [eventId, local?.id ?? null, providerId, payload.event, JSON.stringify(payload)],
    );
    if (insertedRows === 0) return { received: true, processed: true, duplicate: true };
    if (!local || Number(local.total_in_cents) !== Number(provider.amount_in_cents)) {
      await this.markEvent(eventId, 'No coincide la transacción local o el monto');
      throw new BadRequestException({ code: 'EVENT_TRANSACTION_MISMATCH', message: 'El evento no coincide con la transacción' });
    }

    await this.statuses.apply(local.id, {
      id: providerId,
      status: provider.status ?? 'ERROR',
      statusMessage: provider.status_message,
      paymentMethodType: provider.payment_method_type,
    });
    await this.markEvent(eventId);
    return { received: true, processed: true };
  }

  private async markEvent(eventId: string, error?: string) {
    await this.dataSource.query(
      `UPDATE payment_events SET processed = $2, processed_at = NOW(), processing_error = $3
       WHERE provider_event_id = $1`,
      [eventId, !error, error ?? null],
    );
  }
}
