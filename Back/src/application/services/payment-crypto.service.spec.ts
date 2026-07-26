import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PaymentCryptoService } from './payment-crypto.service';

describe('PaymentCryptoService', () => {
  const integritySecret = 'integrity_secret';
  const eventsSecret = 'events_secret';
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'PAYMENT_INTEGRITY_SECRET' ? integritySecret : eventsSecret),
  } as unknown as ConfigService;
  const service = new PaymentCryptoService(config);

  it('creates the Pay integrity signature in the documented order', () => {
    const source = `REF-12350000COP${integritySecret}`;
    const expected = createHash('sha256').update(source).digest('hex');
    expect(service.createIntegritySignature('REF-123', 50000, 'COP')).toBe(expected);
  });

  it('validates dynamic event properties in their supplied order', () => {
    const data = {
      transaction: { id: 'provider-1', status: 'APPROVED', amount_in_cents: 50000 },
    };
    const timestamp = 1530291411;
    const source = `provider-1APPROVED50000${timestamp}${eventsSecret}`;
    const checksum = createHash('sha256').update(source).digest('hex');
    expect(service.verifyEvent(
      data,
      ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      timestamp,
      checksum,
    )).toBe(true);
  });

  it('rejects an altered event', () => {
    expect(service.verifyEvent(
      { transaction: { id: 'provider-1' } },
      ['transaction.id'],
      1,
      '0'.repeat(64),
    )).toBe(false);
  });
});
