import type { ProductRepository } from '../../domain/ports/product.repository';
import { ListProductsUseCase } from './list-products.use-case';

describe('ListProductsUseCase', () => {
  it('returns the products supplied by its repository port', async () => {
    const products = [{
      id: '1', sku: 'TMK-001', name: 'Producto', description: 'Descripción',
      priceInCents: 10000, stock: 2, imageUrl: null, active: true,
    }];
    const repository: ProductRepository = {
      findActive: jest.fn().mockResolvedValue(products),
      findById: jest.fn(),
    };
    await expect(new ListProductsUseCase(repository).execute()).resolves.toEqual(products);
  });
});

