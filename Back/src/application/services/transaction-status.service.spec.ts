import { DataSource, EntityManager } from 'typeorm';
import { TransactionStatusService } from './transaction-status.service';

describe('TransactionStatusService', () => {
  const create = () => {
    const query = jest.fn();
    const manager = { query } as unknown as EntityManager;
    const transaction = jest.fn(
      (run: (entityManager: EntityManager) => Promise<void>) => run(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;

    return {
      query,
      transaction,
      service: new TransactionStatusService(dataSource),
    };
  };

  it('normalizes known states and protects the domain from unknown states', () => {
    const { service } = create();

    expect(service.normalize('approved')).toBe('APPROVED');
    expect(service.normalize('unexpected')).toBe('ERROR');
    expect(service.isFinal('APPROVED')).toBe(true);
    expect(service.isFinal('PENDING')).toBe(false);
  });

  it('applies approval, inventory and delivery confirmation in one transaction', async () => {
    const { service, query, transaction } = create();
    query
      .mockResolvedValueOnce([{
        id: 'transaction-1',
        status: 'PENDING',
        delivery_id: 'delivery-1',
        stock_applied: false,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { product_id: 'product-1', quantity: 2 },
        { product_id: 'product-2', quantity: 1 },
      ])
      .mockResolvedValue([]);

    await service.apply('transaction-1', {
      id: 'provider-1',
      status: 'APPROVED',
      paymentMethodType: 'CARD',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('apply_approved_sale_stock'),
      ['transaction-1', 'product-1', 2],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('apply_approved_sale_stock'),
      ['transaction-1', 'product-2', 1],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE deliveries SET status = 'CONFIRMED'"),
      ['delivery-1'],
    );
  });

  it('does nothing when the same approved state already has stock applied', async () => {
    const { service, query } = create();
    query.mockResolvedValueOnce([{
      id: 'transaction-1',
      status: 'APPROVED',
      delivery_id: 'delivery-1',
      stock_applied: true,
    }]);

    await service.apply('transaction-1', {
      id: 'provider-1',
      status: 'APPROVED',
    });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns safely when the local transaction does not exist', async () => {
    const { service, query } = create();
    query.mockResolvedValueOnce([]);

    await expect(service.apply('missing', {
      id: 'provider-1',
      status: 'DECLINED',
    })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
