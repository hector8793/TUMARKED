import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';
import { PaymentCryptoService } from '../services/payment-crypto.service';
import { TransactionStatusService } from '../services/transaction-status.service';
import { ProcessPaymentUseCase } from './process-payment.use-case';

const transaction = {
  id: 'transaction-1',
  reference: 'TM-001',
  status: 'PENDING',
  total_in_cents: '15990000',
  currency: 'COP',
  provider_transaction_id: null,
  email: 'cliente@example.com',
};

const input = {
  cardToken: 'token-card-123',
  installments: 2,
  acceptanceToken: 'acceptance-token-12345',
  acceptPersonalAuth: 'personal-token-12345',
};

describe('ProcessPaymentUseCase', () => {
  const create = () => {
    const query = jest.fn();
    const dataSource = { query } as unknown as DataSource;
    const gateway: PaymentGatewayPort = {
      createCardPayment: jest.fn(),
      getTransaction: jest.fn(),
    };
    const crypto = {
      createIntegritySignature: jest.fn().mockReturnValue('signature'),
    } as unknown as PaymentCryptoService;
    const statuses = {
      apply: jest.fn(),
      normalize: jest.fn((status: string) => status.toUpperCase()),
    } as unknown as TransactionStatusService;

    return {
      query,
      gateway,
      crypto,
      statuses,
      useCase: new ProcessPaymentUseCase(dataSource, gateway, crypto, statuses),
    };
  };

  it('creates a payment after acquiring the pending transaction atomically', async () => {
    const context = create();
    context.query
      .mockResolvedValueOnce([transaction])
      .mockResolvedValueOnce([[{ id: transaction.id }], 1]);
    jest.mocked(context.gateway.createCardPayment).mockResolvedValue({
      id: 'provider-1',
      status: 'APPROVED',
      paymentMethodType: 'CARD',
    });

    await expect(context.useCase.execute(transaction.id, input, '127.0.0.1')).resolves.toEqual({
      transactionId: transaction.id,
      reference: transaction.reference,
      providerTransactionId: 'provider-1',
      status: 'APPROVED',
      message: null,
    });

    expect(context.gateway.createCardPayment).toHaveBeenCalledWith(expect.objectContaining({
      reference: transaction.reference,
      amountInCents: 15990000,
      cardToken: input.cardToken,
      installments: 2,
      signature: 'signature',
      customerIp: '127.0.0.1',
    }));
    expect(context.statuses.apply).toHaveBeenCalledWith(transaction.id, expect.objectContaining({
      id: 'provider-1',
    }));
  });

  it('conciles an existing provider transaction instead of creating another payment', async () => {
    const context = create();
    context.query.mockResolvedValueOnce([{
      ...transaction,
      status: 'PROCESSING',
      provider_transaction_id: 'provider-existing',
    }]);
    jest.mocked(context.gateway.getTransaction).mockResolvedValue({
      id: 'provider-existing',
      status: 'APPROVED',
    });

    await context.useCase.execute(transaction.id, input);

    expect(context.gateway.getTransaction).toHaveBeenCalledWith('provider-existing');
    expect(context.gateway.createCardPayment).not.toHaveBeenCalled();
    expect(context.statuses.apply).toHaveBeenCalled();
  });

  it('rejects a concurrent payment when the atomic update affects no rows', async () => {
    const context = create();
    context.query
      .mockResolvedValueOnce([transaction])
      .mockResolvedValueOnce([[], 0]);

    await expect(context.useCase.execute(transaction.id, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(context.gateway.createCardPayment).not.toHaveBeenCalled();
  });

  it('marks the local transaction as error when the provider rejects creation', async () => {
    const context = create();
    const providerError = new Error('provider unavailable');
    context.query
      .mockResolvedValueOnce([transaction])
      .mockResolvedValueOnce([[{ id: transaction.id }], 1])
      .mockResolvedValueOnce([]);
    jest.mocked(context.gateway.createCardPayment).mockRejectedValue(providerError);

    await expect(context.useCase.execute(transaction.id, input)).rejects.toBe(providerError);

    expect(context.query).toHaveBeenLastCalledWith(
      expect.stringContaining("SET status = 'ERROR'"),
      [transaction.id, expect.any(String)],
    );
  });

  it('rejects missing and non-payable transactions before contacting the provider', async () => {
    const missing = create();
    missing.query.mockResolvedValueOnce([]);
    await expect(missing.useCase.execute('missing', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const approved = create();
    approved.query.mockResolvedValueOnce([{ ...transaction, status: 'APPROVED' }]);
    await expect(approved.useCase.execute(transaction.id, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(approved.gateway.createCardPayment).not.toHaveBeenCalled();
  });
});
