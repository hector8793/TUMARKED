import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ListTransactionsUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute() {
    const rows = await this.dataSource.query<Array<{
      id: string;
      reference: string;
      status: string;
      total_in_cents: string;
      currency: string;
      created_at: Date;
      customer_name: string;
      city: string;
      products: Array<{ name: string; quantity: number }>;
    }>>(
      `SELECT
         t.id, t.reference, t.status, t.total_in_cents, t.currency, t.created_at,
         CONCAT(LEFT(c.first_name, 1), '*** ', LEFT(c.last_name, 1), '***') AS customer_name,
         d.city,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('name', ti.product_name, 'quantity', ti.quantity)
             ORDER BY ti.created_at
           ) FILTER (WHERE ti.id IS NOT NULL),
           '[]'::JSON
         ) AS products
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       JOIN deliveries d ON d.id = t.delivery_id
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       GROUP BY t.id, c.id, d.id
       ORDER BY t.created_at DESC
       LIMIT 100`,
    );

    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      totalInCents: Number(row.total_in_cents),
      currency: row.currency,
      createdAt: row.created_at,
      customerName: row.customer_name,
      city: row.city,
      products: row.products,
    }));
  }
}

