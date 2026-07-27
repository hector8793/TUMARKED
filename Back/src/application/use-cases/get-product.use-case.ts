import { Inject, Injectable } from '@nestjs/common';
import { Product } from '../../domain/entities/product';
import { ApplicationError } from '../../domain/errors/application-error';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/ports/product.repository';
import { failure, Result, success } from '../../domain/result/result';

@Injectable()
export class GetProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}
  async execute(id: string): Promise<Result<Product, ApplicationError>> {
    const product = await this.products.findById(id);
    if (!product) {
      return failure({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado',
      });
    }
    return success(product);
  }
}
