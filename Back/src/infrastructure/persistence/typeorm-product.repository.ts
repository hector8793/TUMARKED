import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Product } from '../../domain/entities/product';
import type { ProductRepository } from '../../domain/ports/product.repository';
import { ProductOrmEntity } from './product.orm-entity';

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(@InjectRepository(ProductOrmEntity) private readonly repository: Repository<ProductOrmEntity>) {}

  async findActive(): Promise<Product[]> {
    const records = await this.repository.find({ where: { active: true }, order: { name: 'ASC' } });
    return records.map(this.toDomain);
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.repository.findOneBy({ id });
    return record ? this.toDomain(record) : null;
  }

  private readonly toDomain = (record: ProductOrmEntity): Product => ({
    id: record.id,
    sku: record.sku,
    name: record.name,
    description: record.description,
    priceInCents: Number(record.priceInCents),
    stock: record.stock,
    imageUrl: record.imageUrl,
    active: record.active,
  });
}

