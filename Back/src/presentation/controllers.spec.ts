import { CreateCheckoutUseCase } from '../application/use-cases/create-checkout.use-case';
import { GetProductUseCase } from '../application/use-cases/get-product.use-case';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction.use-case';
import { HandlePaymentEventUseCase } from '../application/use-cases/handle-payment-event.use-case';
import { ListProductsUseCase } from '../application/use-cases/list-products.use-case';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions.use-case';
import { ProcessPaymentUseCase } from '../application/use-cases/process-payment.use-case';
import { failure, success } from '../domain/result/result';
import { CheckoutsController } from './checkouts.controller';
import { HealthController } from './health.controller';
import { ProductsController } from './products.controller';
import { TransactionsController } from './transactions.controller';
import { WebhooksController } from './webhooks.controller';

describe('presentation controllers', () => {
  it('delegates checkout creation', () => {
    const execute = jest.fn().mockReturnValue({ id: 'checkout' });
    const controller = new CheckoutsController({ execute } as unknown as CreateCheckoutUseCase);
    const input = { productId: 'product-1' };

    expect(controller.create(input as never)).toEqual({ id: 'checkout' });
    expect(execute).toHaveBeenCalledWith(input);
  });

  it('delegates product queries and maps stock', async () => {
    const list = { execute: jest.fn().mockReturnValue(['product']) };
    const get = {
      execute: jest.fn().mockResolvedValue(success({
        id: 'product-1',
        sku: 'TM-1',
        name: 'Producto',
        description: 'Descripción',
        priceInCents: 10000,
        stock: 4,
        imageUrl: null,
        active: true,
      })),
    };
    const controller = new ProductsController(
      list as unknown as ListProductsUseCase,
      get as unknown as GetProductUseCase,
    );

    expect(controller.findAll()).toEqual(['product']);
    await expect(controller.findOne('product-1')).resolves.toEqual(
      expect.objectContaining({ id: 'product-1' }),
    );
    await expect(controller.stock('product-1')).resolves.toEqual({
      productId: 'product-1',
      stock: 4,
      active: true,
    });
  });

  it('maps a product application failure to the original HTTP exception', async () => {
    const controller = new ProductsController(
      { execute: jest.fn() } as unknown as ListProductsUseCase,
      {
        execute: jest.fn().mockResolvedValue(failure({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Producto no encontrado',
        })),
      } as unknown as GetProductUseCase,
    );

    await expect(controller.findOne('missing')).rejects.toMatchObject({
      status: 404,
      response: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado',
      },
    });
  });

  it('delegates transaction list, detail and payment', () => {
    const list = { execute: jest.fn().mockReturnValue(['transaction']) };
    const payment = { execute: jest.fn().mockReturnValue({ status: 'APPROVED' }) };
    const get = { execute: jest.fn().mockReturnValue({ id: 'transaction-1' }) };
    const controller = new TransactionsController(
      list as unknown as ListTransactionsUseCase,
      payment as unknown as ProcessPaymentUseCase,
      get as unknown as GetTransactionUseCase,
    );

    expect(controller.findAll()).toEqual(['transaction']);
    expect(controller.findOne('transaction-1')).toEqual({ id: 'transaction-1' });
    expect(controller.pay('transaction-1', { installments: 1 } as never, '127.0.0.1'))
      .toEqual({ status: 'APPROVED' });
    expect(payment.execute).toHaveBeenCalledWith(
      'transaction-1',
      { installments: 1 },
      '127.0.0.1',
    );
  });

  it('delegates webhook events and returns health', () => {
    const execute = jest.fn().mockReturnValue({ received: true });
    const webhooks = new WebhooksController({
      execute,
    } as unknown as HandlePaymentEventUseCase);
    const payload = { event: 'transaction.updated' };

    expect(webhooks.receive(payload as never, 'checksum')).toEqual({ received: true });
    expect(execute).toHaveBeenCalledWith(payload, 'checksum');

    const health = new HealthController().check();
    expect(health.status).toBe('ok');
    expect(new Date(health.timestamp).toString()).not.toBe('Invalid Date');
  });
});
