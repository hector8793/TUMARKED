import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateCheckoutUseCase } from '../application/use-cases/create-checkout.use-case';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('checkouts')
@Controller('checkouts')
export class CheckoutsController {
  constructor(private readonly createCheckout: CreateCheckoutUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea un checkout pendiente con valores calculados por el servidor' })
  create(@Body() input: CreateCheckoutDto) {
    return this.createCheckout.execute(input);
  }
}

