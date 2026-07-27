import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiParam, ApiTags,
} from '@nestjs/swagger';
import { GetProductUseCase } from '../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../application/use-cases/list-products.use-case';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProductsUseCase, private readonly getProduct: GetProductUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los productos activos',
    description: 'Devuelve el catálogo ordenado por nombre con precio expresado en centavos.',
  })
  @ApiOkResponse({
    description: 'Catálogo activo',
    schema: {
      example: [{
        id: '7dc1fdb7-6b25-4b8f-9582-d465d189c272',
        sku: 'TMK-AUD-001',
        name: 'Audífonos inalámbricos',
        description: 'Audífonos para música, llamadas y trabajo diario.',
        priceInCents: 18990000,
        stock: 24,
        imageUrl: '/headphones.webp',
        active: true,
      }],
    },
  })
  findAll() { return this.listProducts.execute(); }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta un producto' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Identificador del producto' })
  @ApiOkResponse({
    description: 'Producto encontrado',
    schema: {
      example: {
        id: '7dc1fdb7-6b25-4b8f-9582-d465d189c272',
        sku: 'TMK-AUD-001',
        name: 'Audífonos inalámbricos',
        priceInCents: 18990000,
        stock: 24,
        imageUrl: '/headphones.webp',
        active: true,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'El identificador no es un UUID válido' })
  @ApiNotFoundResponse({
    description: 'Producto inexistente',
    schema: { example: { code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' } },
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) { return this.getProduct.execute(id); }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Consulta el inventario actual' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Identificador del producto' })
  @ApiOkResponse({
    description: 'Disponibilidad actual',
    schema: {
      example: {
        productId: '7dc1fdb7-6b25-4b8f-9582-d465d189c272',
        stock: 24,
        active: true,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'El identificador no es un UUID válido' })
  @ApiNotFoundResponse({ description: 'Producto inexistente' })
  async stock(@Param('id', new ParseUUIDPipe()) id: string) {
    const product = await this.getProduct.execute(id);
    return { productId: product.id, stock: product.stock, active: product.active };
  }
}
