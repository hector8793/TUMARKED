import type { Product } from '../../models/product';
import reducer, { fetchProducts } from './productsSlice';

jest.mock('../../services/api', () => ({
  api: {
    listProducts: jest.fn(),
  },
}));

const product: Product = {
  id: 'product-1',
  sku: 'TM-001',
  name: 'Producto de prueba',
  description: 'Descripción',
  priceInCents: 15990000,
  stock: 4,
  imageUrl: null,
  active: true,
};

describe('productsSlice', () => {
  it('moves to loading while products are requested', () => {
    const state = reducer(undefined, fetchProducts.pending('request-1', undefined));

    expect(state).toEqual({
      items: [],
      status: 'loading',
      error: null,
    });
  });

  it('stores the products returned by the API', () => {
    const state = reducer(
      undefined,
      fetchProducts.fulfilled([product], 'request-1', undefined),
    );

    expect(state.items).toEqual([product]);
    expect(state.status).toBe('succeeded');
    expect(state.error).toBeNull();
  });

  it('exposes a readable error when the request fails', () => {
    const state = reducer(
      undefined,
      fetchProducts.rejected(new Error('network'), 'request-1', undefined),
    );

    expect(state.status).toBe('failed');
    expect(state.error).toBe('No fue posible cargar los productos.');
  });
});
