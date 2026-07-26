import {
  ConflictException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PAYMENT_GATEWAY, PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';
import { ProcessPaymentDto } from '../../presentation/dto/process-payment.dto';
import { PaymentCryptoService } from '../services/payment-crypto.service';
import { TransactionStatusService } from '../services/transaction-status.service';

interface PayableTransaction {
  id: string;
  reference: string;
  status: string;
  total_in_cents: string;
  currency: 'COP';
  provider_transaction_id: string | null;
  email: string;
}

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    private readonly crypto: PaymentCryptoService,
    private readonly statuses: TransactionStatusService,
  ) {}

  async execute(id: string, input: ProcessPaymentDto, customerIp?: string) {
    const transaction = await this.find(id);
    if (transaction.provider_transaction_id) {
      const provider = await this.gateway.getTransaction(transaction.provider_transaction_id);
      await this.statuses.apply(id, provider);
      return this.response(id, transaction.reference, provider);
    }
    if (transaction.status !== 'PENDING') {
      throw new ConflictException({
        code: 'TRANSACTION_NOT_PAYABLE',
        message: 'La transacción no se encuentra disponible para pago',
      });
    }

    const [, affectedRows] = await this.dataSource.query<[Array<{ id: string }>, number]>(
      `UPDATE transactions SET status = 'PROCESSING', installments = $2
       WHERE id = $1 AND status = 'PENDING' RETURNING id`,
      [id, input.installments],
    );
    if (affectedRows !== 1) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_PROCESSING',
        message: 'El pago ya está siendo procesado',
      });
    }

    try {
      const amount = Number(transaction.total_in_cents);
      const provider = await this.gateway.createCardPayment({
        reference: transaction.reference,
        amountInCents: amount,
        currency: transaction.currency,
        customerEmail: transaction.email,
        cardToken: input.cardToken,
        installments: input.installments,
        signature: this.crypto.createIntegritySignature(
          transaction.reference, amount, transaction.currency,
        ),
        acceptanceToken: input.acceptanceToken,
        acceptPersonalAuth: input.acceptPersonalAuth,
        customerIp,
      });
      await this.statuses.apply(id, provider);
      return this.response(id, transaction.reference, provider);
    } catch (error) {
      await this.dataSource.query(
        `UPDATE transactions SET status = 'ERROR', failure_reason = $2, processed_at = NOW()
         WHERE id = $1 AND provider_transaction_id IS NULL`,
        [id, 'No fue posible crear la transacción en la pasarela'],
      );
      throw error;
    }
  }

  private async find(id: string): Promise<PayableTransaction> {
    const rows = await this.dataSource.query<PayableTransaction[]>(
      `SELECT t.id, t.reference, t.status, t.total_in_cents, t.currency,
              t.provider_transaction_id, c.email
       FROM transactions t JOIN customers c ON c.id = t.customer_id
       WHERE t.id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transacción no encontrada' });
    }
    return rows[0];
  }

  private response(
    transactionId: string,
    reference: string,
    provider: { id: string; status: string; statusMessage?: string },
  ) {
    return {
      transactionId,
      reference,
      providerTransactionId: provider.id,
      status: this.statuses.normalize(provider.status),
      message: provider.statusMessage ?? null,
    };
  }
}
