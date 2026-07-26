import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { CreateCheckoutUseCase } from './application/use-cases/create-checkout.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { PRODUCT_REPOSITORY } from './domain/ports/product.repository';
import { ProductOrmEntity } from './infrastructure/persistence/product.orm-entity';
import { TypeOrmProductRepository } from './infrastructure/persistence/typeorm-product.repository';
import { HealthController } from './presentation/health.controller';
import { ProductsController } from './presentation/products.controller';
import { CheckoutsController } from './presentation/checkouts.controller';
import { TransactionsController } from './presentation/transactions.controller';
import { WebhooksController } from './presentation/webhooks.controller';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { GetTransactionUseCase } from './application/use-cases/get-transaction.use-case';
import { HandlePaymentEventUseCase } from './application/use-cases/handle-payment-event.use-case';
import { PaymentCryptoService } from './application/services/payment-crypto.service';
import { TransactionStatusService } from './application/services/transaction-status.service';
import { PAYMENT_GATEWAY } from './domain/ports/payment-gateway.port';
import { PaymentProviderAdapter } from './infrastructure/payment-provider/payment-provider.adapter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sslEnabled = config.get('DATABASE_SSL', 'true') === 'true';
        const rejectUnauthorized =
          config.get('DATABASE_SSL_REJECT_UNAUTHORIZED', 'false') === 'true';

        return {
          type: 'postgres',
          url: config.getOrThrow<string>('DATABASE_URL'),
          autoLoadEntities: true,
          synchronize: false,
          ssl: sslEnabled ? { rejectUnauthorized } : false,
        };
      },
    }),
    TypeOrmModule.forFeature([ProductOrmEntity]),
  ],
  controllers: [
    ProductsController, CheckoutsController, TransactionsController,
    WebhooksController, HealthController,
  ],
  providers: [
    ListProductsUseCase,
    GetProductUseCase,
    CreateCheckoutUseCase,
    ListTransactionsUseCase,
    ProcessPaymentUseCase,
    GetTransactionUseCase,
    HandlePaymentEventUseCase,
    PaymentCryptoService,
    TransactionStatusService,
    PaymentProviderAdapter,
    { provide: PAYMENT_GATEWAY, useExisting: PaymentProviderAdapter },
    TypeOrmProductRepository,
    { provide: PRODUCT_REPOSITORY, useExisting: TypeOrmProductRepository },
  ],
})
export class AppModule {}
