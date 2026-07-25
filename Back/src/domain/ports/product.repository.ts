import type { Product } from '../entities/product';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findActive(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
}

