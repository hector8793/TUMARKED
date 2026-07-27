import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse,
  ApiOperation, ApiTags, ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CreateCheckoutUseCase } from '../application/use-cases/create-checkout.use-case';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('checkouts')
@Controller('checkouts')
export class CheckoutsController {
  constructor(private readonly createCheckout: CreateCheckoutUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea un checkout pendiente',
    description: 'Valida producto y stock, crea cliente y entrega, y calcula todos los valores en el servidor.',
  })
  @ApiCreatedResponse({
    description: 'Checkout creado',
    schema: {
      example: {
        transactionId: '22559c28-437b-422b-964d-facf72aece33',
        reference: 'TM-1785070944142-9FE498',
        status: 'PENDING',
        amounts: {
          subtotal: 18990000,
          baseFee: 500000,
          deliveryFee: 1200000,
          total: 20690000,
          currency: 'COP',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'DTO inválido o campos desconocidos',
    schema: {
      example: {
        statusCode: 400,
        message: ['quantity must not be less than 1'],
        error: 'Bad Request',
      },
    },
  })
  @ApiConflictResponse({
    description: 'Stock insuficiente',
    schema: {
      example: {
        code: 'INSUFFICIENT_STOCK',
        message: 'No hay unidades suficientes',
        details: { available: 1, requested: 2 },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'Producto inexistente o inactivo',
    schema: {
      example: {
        code: 'PRODUCT_UNAVAILABLE',
        message: 'El producto no está disponible',
      },
    },
  })
  create(@Body() input: CreateCheckoutDto) {
    return this.createCheckout.execute(input);
  }
}
