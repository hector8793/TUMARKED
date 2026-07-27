import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PaymentProviderAdapter } from './payment-provider/payment-provider.adapter';
import { ProductOrmEntity } from './persistence/product.orm-entity';
import { TypeOrmProductRepository } from './persistence/typeorm-product.repository';

describe('PaymentProviderAdapter', () => {
  const originalFetch = global.fetch;
  const adapter = new PaymentProviderAdapter({
    getOrThrow: jest.fn((key: string) => (
      key === 'PAYMENT_API_URL' ? 'https://payments.example/v1/' : 'private-key'
    )),
  } as unknown as ConfigService);

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates a card payment with authorization and optional IP', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({
        data: {
          id: 'provider-1',
          status: 'APPROVED',
          status_message: 'Approved',
          payment_method_type: 'CARD',
        },
      }),
    });

    await expect(adapter.createCardPayment({
      reference: 'TM-1',
      amountInCents: 50000,
      currency: 'COP',
      customerEmail: 'customer@example.com',
      cardToken: 'card-token',
      installments: 1,
      signature: 'signature',
      acceptanceToken: 'acceptance',
      acceptPersonalAuth: 'personal',
      customerIp: '127.0.0.1',
    })).resolves.toEqual({
      id: 'provider-1',
      status: 'APPROVED',
      statusMessage: 'Approved',
      paymentMethodType: 'CARD',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://payments.example/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer private-key' }),
      }),
    );
    const request = jest.mocked(global.fetch).mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toEqual(expect.objectContaining({
      reference: 'TM-1',
      ip: '127.0.0.1',
    }));
  });

  it('gets an existing transaction', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: { id: 'provider/1', status: 'PENDING' } }),
    });

    await expect(adapter.getTransaction('provider/1')).resolves.toEqual(expect.objectContaining({
      status: 'PENDING',
    }));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://payments.example/v1/transactions/provider%2F1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('maps provider and network failures to controlled exceptions', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({
        error: { type: 'VALIDATION', reason: 'invalid' },
      }),
    });
    await expect(adapter.getTransaction('provider-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(adapter.getTransaction('provider-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('handles malformed successful responses as provider errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });

    await expect(adapter.getTransaction('provider-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('TypeOrmProductRepository', () => {
  const record = {
    id: 'product-1',
    sku: 'TM-1',
    name: 'Producto',
    description: 'Descripción',
    priceInCents: '50000',
    stock: 3,
    imageUrl: null,
    active: true,
  } as ProductOrmEntity;

  it('maps active records and individual products to the domain', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([record]),
      findOneBy: jest.fn().mockResolvedValueOnce(record).mockResolvedValueOnce(null),
    } as unknown as Repository<ProductOrmEntity>;
    const adapter = new TypeOrmProductRepository(repository);

    await expect(adapter.findActive()).resolves.toEqual([
      expect.objectContaining({ id: record.id, priceInCents: 50000 }),
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { active: true },
      order: { name: 'ASC' },
    });
    await expect(adapter.findById(record.id)).resolves.toEqual(
      expect.objectContaining({ sku: 'TM-1' }),
    );
    await expect(adapter.findById('missing')).resolves.toBeNull();
  });
});
