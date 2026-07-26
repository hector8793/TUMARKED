import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentCryptoService } from '../services/payment-crypto.service';
import { TransactionStatusService } from '../services/transaction-status.service';
import {
  HandlePaymentEventUseCase,
  PaymentEventPayload,
} from './handle-payment-event.use-case';

const payload: PaymentEventPayload = {
  event: 'transaction.updated',
  data: {
    transaction: {
      id: 'provider-1',
      reference: 'TM-001',
      status: 'APPROVED',
      amount_in_cents: 50000,
      payment_method_type: 'CARD',
    },
  },
  timestamp: 1785071449,
  signature: {
    properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
    checksum: 'valid-checksum',
  },
};

describe('HandlePaymentEventUseCase', () => {
  const create = (signatureValid = true) => {
    const query = jest.fn();
    const dataSource = { query } as unknown as DataSource;
    const crypto = {
      verifyEvent: jest.fn().mockReturnValue(signatureValid),
    } as unknown as PaymentCryptoService;
    const statuses = {
      apply: jest.fn(),
    } as unknown as TransactionStatusService;

    return {
      query,
      crypto,
      statuses,
      useCase: new HandlePaymentEventUseCase(dataSource, crypto, statuses),
    };
  };

  it('rejects events with an invalid signature', async () => {
    const context = create(false);

    await expect(context.useCase.execute(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(context.query).not.toHaveBeenCalled();
  });

  it('ignores valid event types that do not update a transaction', async () => {
    const context = create();

    await expect(context.useCase.execute({
      ...payload,
      event: 'other.event',
    })).resolves.toEqual({ received: true, processed: false });
    expect(context.query).not.toHaveBeenCalled();
  });

  it('processes and marks a matching event', async () => {
    const context = create();
    context.query
      .mockResolvedValueOnce([{ id: 'transaction-1', total_in_cents: '50000' }])
      .mockResolvedValueOnce([[{ id: 'event-1' }], 1])
      .mockResolvedValueOnce([]);

    await expect(context.useCase.execute(payload)).resolves.toEqual({
      received: true,
      processed: true,
    });

    expect(context.statuses.apply).toHaveBeenCalledWith(
      'transaction-1',
      expect.objectContaining({ id: 'provider-1', status: 'APPROVED' }),
    );
    expect(context.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE payment_events'),
      [expect.any(String), true, null],
    );
  });

  it('recognizes a duplicated event without applying its state again', async () => {
    const context = create();
    context.query
      .mockResolvedValueOnce([{ id: 'transaction-1', total_in_cents: '50000' }])
      .mockResolvedValueOnce([[], 0]);

    await expect(context.useCase.execute(payload)).resolves.toEqual({
      received: true,
      processed: true,
      duplicate: true,
    });
    expect(context.statuses.apply).not.toHaveBeenCalled();
  });

  it('records and rejects an event whose amount does not match', async () => {
    const context = create();
    context.query
      .mockResolvedValueOnce([{ id: 'transaction-1', total_in_cents: '90000' }])
      .mockResolvedValueOnce([[{ id: 'event-1' }], 1])
      .mockResolvedValueOnce([]);

    await expect(context.useCase.execute(payload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(context.statuses.apply).not.toHaveBeenCalled();
    expect(context.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE payment_events'),
      [expect.any(String), false, expect.any(String)],
    );
  });
});
