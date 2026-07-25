import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'products' })
export class ProductOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 80 }) sku: string;
  @Column({ length: 160 }) name: string;
  @Column('text') description: string;
  @Column({ name: 'price_in_cents', type: 'bigint' }) priceInCents: string;
  @Column('integer') stock: number;
  @Column({ name: 'image_url', type: 'text', nullable: true }) imageUrl: string | null;
  @Column('boolean') active: boolean;
}

