import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';
import type { ProductRepository } from '../../domain/ports/product.repository';
import { TransactionStatusService } from '../services/transaction-status.service';
import { CreateCheckoutUseCase } from './create-checkout.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { GetTransactionUseCase } from './get-transaction.use-case';
import { ListTransactionsUseCase } from './list-transactions.use-case';

const checkoutInput = {
  productId: 'product-1',
  quantity: 2,
  customer: {
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: '3001234567',
  },
  delivery: {
    address: 'Calle 1',
    city: 'Bogotá',
    department: 'Bogotá',
  },
};

describe('CreateCheckoutUseCase', () => {
  const create = () => {
    const query = jest.fn();
    const manager = { query } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((run: (value: EntityManager) => unknown) => run(manager)),
    } as unknown as DataSource;
    return { query, useCase: new CreateCheckoutUseCase(dataSource) };
  };

  it('creates customer, delivery, transaction, item and initial history', async () => {
    const { query, useCase } = create();
    query
      .mockResolvedValueOnce([{
        id: 'product-1',
        sku: 'TM-1',
        name: 'Producto',
        price_in_cents: '10000',
        stock: 5,
        active: true,
      }])
      .mockResolvedValueOnce([{ id: 'customer-1' }])
      .mockResolvedValueOnce([{ id: 'delivery-1' }])
      .mockResolvedValueOnce([{ id: 'transaction-1', status: 'PENDING' }])
      .mockResolvedValue([]);

    const result = await useCase.execute(checkoutInput);

    expect(result).toEqual(expect.objectContaining({
      transactionId: 'transaction-1',
      status: 'PENDING',
      amounts: {
        subtotal: 20000,
        baseFee: 500000,
        deliveryFee: 1200000,
        total: 1720000,
        currency: 'COP',
      },
    }));
    expect(result.reference).toMatch(/^TM-\d+-[A-Z0-9]{6}$/);
    expect(query).toHaveBeenCalledTimes(6);
  });

  it('rejects missing or inactive products', async () => {
    const missing = create();
    missing.query.mockResolvedValueOnce([]);
    await expect(missing.useCase.execute(checkoutInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    const inactive = create();
    inactive.query.mockResolvedValueOnce([{ active: false }]);
    await expect(inactive.useCase.execute(checkoutInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects quantities greater than available stock', async () => {
    const { query, useCase } = create();
    query.mockResolvedValueOnce([{ active: true, stock: 1 }]);

    await expect(useCase.execute(checkoutInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('query use cases', () => {
  it('gets a product through its repository and rejects a missing one', async () => {
    const product = {
      id: 'product-1',
      sku: 'TM-1',
      name: 'Producto',
      description: 'Descripción',
      priceInCents: 10000,
      stock: 2,
      imageUrl: null,
      active: true,
    };
    const products: ProductRepository = {
      findActive: jest.fn(),
      findById: jest.fn().mockResolvedValueOnce(product).mockResolvedValueOnce(null),
    };
    const useCase = new GetProductUseCase(products);

    await expect(useCase.execute(product.id)).resolves.toEqual({
      ok: true,
      value: product,
    });
    await expect(useCase.execute('missing')).resolves.toEqual({
      ok: false,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado',
      },
    });
  });

  it('maps recent transactions to the public response', async () => {
    const createdAt = new Date();
    const query = jest.fn().mockResolvedValue([{
      id: 'transaction-1',
      reference: 'TM-1',
      status: 'APPROVED',
      total_in_cents: '50000',
      currency: 'COP',
      created_at: createdAt,
      customer_name: 'A*** P***',
      city: 'Bogotá',
      products: [{ name: 'Producto', quantity: 1 }],
    }]);
    const useCase = new ListTransactionsUseCase({ query } as unknown as DataSource);

    await expect(useCase.execute()).resolves.toEqual([{
      id: 'transaction-1',
      reference: 'TM-1',
      status: 'APPROVED',
      totalInCents: 50000,
      currency: 'COP',
      createdAt,
      customerName: 'A*** P***',
      city: 'Bogotá',
      products: [{ name: 'Producto', quantity: 1 }],
    }]);
  });

  it('returns a final transaction without contacting the provider', async () => {
    const row = {
      id: 'transaction-1',
      reference: 'TM-1',
      status: 'APPROVED',
      provider_transaction_id: 'provider-1',
      provider_status: 'APPROVED',
      total_in_cents: '50000',
      currency: 'COP',
      failure_reason: null,
      created_at: new Date(),
    };
    const query = jest.fn().mockResolvedValue([row]);
    const gateway: PaymentGatewayPort = {
      createCardPayment: jest.fn(),
      getTransaction: jest.fn(),
    };
    const statuses = {
      isFinal: jest.fn().mockReturnValue(true),
      apply: jest.fn(),
    } as unknown as TransactionStatusService;
    const useCase = new GetTransactionUseCase(
      { query } as unknown as DataSource,
      gateway,
      statuses,
    );

    await expect(useCase.execute(row.id)).resolves.toEqual(expect.objectContaining({
      id: row.id,
      totalInCents: 50000,
    }));
    expect(gateway.getTransaction).not.toHaveBeenCalled();
  });

  it('reconciles a non-final transaction and rejects a missing one', async () => {
    const pending = {
      id: 'transaction-1',
      reference: 'TM-1',
      status: 'PENDING',
      provider_transaction_id: 'provider-1',
      provider_status: 'PENDING',
      total_in_cents: '50000',
      currency: 'COP',
      failure_reason: null,
      created_at: new Date(),
    };
    const approved = { ...pending, status: 'APPROVED', provider_status: 'APPROVED' };
    const query = jest.fn()
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([approved]);
    const gateway: PaymentGatewayPort = {
      createCardPayment: jest.fn(),
      getTransaction: jest.fn().mockResolvedValue({ id: 'provider-1', status: 'APPROVED' }),
    };
    const statuses = {
      isFinal: jest.fn().mockReturnValue(false),
      apply: jest.fn(),
    } as unknown as TransactionStatusService;
    const useCase = new GetTransactionUseCase(
      { query } as unknown as DataSource,
      gateway,
      statuses,
    );

    await expect(useCase.execute(pending.id)).resolves.toEqual(expect.objectContaining({
      status: 'APPROVED',
    }));
    expect(statuses.apply).toHaveBeenCalled();

    const missing = new GetTransactionUseCase(
      { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource,
      gateway,
      statuses,
    );
    await expect(missing.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
