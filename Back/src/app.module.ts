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
  controllers: [ProductsController, CheckoutsController, TransactionsController, HealthController],
  providers: [
    ListProductsUseCase,
    GetProductUseCase,
    CreateCheckoutUseCase,
    ListTransactionsUseCase,
    TypeOrmProductRepository,
    { provide: PRODUCT_REPOSITORY, useExisting: TypeOrmProductRepository },
  ],
})
export class AppModule {}
