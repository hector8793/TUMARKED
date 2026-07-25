import { Inject, Injectable } from '@nestjs/common';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/ports/product.repository';

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}
  execute() { return this.products.findActive(); }
}

