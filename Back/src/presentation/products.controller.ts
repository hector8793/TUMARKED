import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetProductUseCase } from '../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../application/use-cases/list-products.use-case';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProductsUseCase, private readonly getProduct: GetProductUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Lista los productos activos' })
  findAll() { return this.listProducts.execute(); }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta un producto' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) { return this.getProduct.execute(id); }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Consulta el inventario actual' })
  async stock(@Param('id', new ParseUUIDPipe()) id: string) {
    const product = await this.getProduct.execute(id);
    return { productId: product.id, stock: product.stock, active: product.active };
  }
}

