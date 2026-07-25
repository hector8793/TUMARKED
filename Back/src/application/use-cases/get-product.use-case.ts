import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/ports/product.repository';

@Injectable()
export class GetProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}
  async execute(id: string) {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' });
    return product;
  }
}

