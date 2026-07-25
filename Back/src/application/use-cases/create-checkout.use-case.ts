import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateCheckoutDto } from '../../presentation/dto/create-checkout.dto';

const BASE_FEE = 500_000;
const DELIVERY_FEE = 1_200_000;

@Injectable()
export class CreateCheckoutUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: CreateCheckoutDto) {
    return this.dataSource.transaction(async (manager) => {
      const products = await manager.query<Array<{
        id: string; sku: string; name: string; price_in_cents: string;
        stock: number; active: boolean;
      }>>(
        'SELECT id, sku, name, price_in_cents, stock, active FROM products WHERE id = $1 FOR SHARE',
        [input.productId],
      );
      const product = products[0];
      if (!product || !product.active) {
        throw new UnprocessableEntityException({
          code: 'PRODUCT_UNAVAILABLE', message: 'El producto no está disponible',
        });
      }
      if (product.stock < input.quantity) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay unidades suficientes',
          details: { available: product.stock, requested: input.quantity },
        });
      }

      const [customer] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO customers (first_name, last_name, email, phone)
         VALUES ($1, $2, LOWER($3), $4) RETURNING id`,
        [input.customer.firstName, input.customer.lastName, input.customer.email, input.customer.phone],
      );
      const [delivery] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO deliveries (customer_id, address, city, department, postal_code, instructions)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [customer.id, input.delivery.address, input.delivery.city, input.delivery.department,
          input.delivery.postalCode ?? null, input.delivery.instructions ?? null],
      );

      const unitPrice = Number(product.price_in_cents);
      const subtotal = unitPrice * input.quantity;
      const total = subtotal + BASE_FEE + DELIVERY_FEE;
      const reference = `TM-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const [transaction] = await manager.query<Array<{ id: string; status: string }>>(
        `INSERT INTO transactions (
           reference, customer_id, delivery_id, status, subtotal_in_cents,
           base_fee_in_cents, delivery_fee_in_cents, total_in_cents
         ) VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7)
         RETURNING id, status`,
        [reference, customer.id, delivery.id, subtotal, BASE_FEE, DELIVERY_FEE, total],
      );
      await manager.query(
        `INSERT INTO transaction_items (
           transaction_id, product_id, product_sku, product_name,
           unit_price_in_cents, quantity, line_total_in_cents
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transaction.id, product.id, product.sku, product.name, unitPrice, input.quantity, subtotal],
      );
      await manager.query(
        `INSERT INTO transaction_status_history (transaction_id, new_status, source, reason)
         VALUES ($1, 'PENDING', 'API', 'Checkout created')`,
        [transaction.id],
      );

      return {
        transactionId: transaction.id,
        reference,
        status: transaction.status,
        amounts: {
          subtotal, baseFee: BASE_FEE, deliveryFee: DELIVERY_FEE, total, currency: 'COP',
        },
      };
    });
  }
}

