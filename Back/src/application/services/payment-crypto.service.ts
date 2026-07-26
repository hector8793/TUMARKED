import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class PaymentCryptoService {
  private readonly integritySecret: string;
  private readonly eventsSecret: string;

  constructor(config: ConfigService) {
    this.integritySecret = config.getOrThrow<string>('PAYMENT_INTEGRITY_SECRET');
    this.eventsSecret = config.getOrThrow<string>('PAYMENT_EVENTS_SECRET');
  }

  createIntegritySignature(reference: string, amountInCents: number, currency: string): string {
    return this.sha256(`${reference}${amountInCents}${currency}${this.integritySecret}`);
  }

  verifyEvent(
    data: Record<string, unknown>,
    properties: string[],
    timestamp: number,
    checksum: string,
  ): boolean {
    const values = properties.map((property) => this.readPath(data, property));
    if (values.some((value) => value === undefined || value === null)) return false;
    const calculated = this.sha256(`${values.join('')}${timestamp}${this.eventsSecret}`);
    const expectedBuffer = Buffer.from(checksum.toLowerCase(), 'utf8');
    const calculatedBuffer = Buffer.from(calculated, 'utf8');
    return expectedBuffer.length === calculatedBuffer.length
      && timingSafeEqual(expectedBuffer, calculatedBuffer);
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[key];
    }, source);
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
