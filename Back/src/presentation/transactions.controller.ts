import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction.use-case';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions.use-case';
import { ProcessPaymentUseCase } from '../application/use-cases/process-payment.use-case';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly listTransactions: ListTransactionsUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly getTransaction: GetTransactionUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los pedidos recientes',
    description: 'Devuelve hasta 100 pedidos con los datos personales del comprador enmascarados.',
  })
  @ApiOkResponse({
    description: 'Pedidos recientes',
    schema: {
      example: [{
        id: '22559c28-437b-422b-964d-facf72aece33',
        reference: 'TM-1785070944142-9FE498',
        status: 'APPROVED',
        totalInCents: 20690000,
        currency: 'COP',
        createdAt: '2026-07-27T12:00:00.000Z',
        customerName: 'A*** P***',
        city: 'Bogotá',
        products: [{ name: 'Audífonos inalámbricos', quantity: 1 }],
      }],
    },
  })
  findAll() {
    return this.listTransactions.execute();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta y concilia una transacción',
    description: 'Si existe una transacción externa no final, consulta la pasarela antes de responder.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Identificador local de la transacción' })
  @ApiOkResponse({
    description: 'Estado actual',
    schema: {
      example: {
        id: '22559c28-437b-422b-964d-facf72aece33',
        reference: 'TM-1785070944142-9FE498',
        status: 'APPROVED',
        providerTransactionId: 'provider-example-123',
        providerStatus: 'APPROVED',
        totalInCents: 20690000,
        currency: 'COP',
        failureReason: null,
        createdAt: '2026-07-27T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'El identificador no es un UUID válido' })
  @ApiNotFoundResponse({
    description: 'Transacción inexistente',
    schema: {
      example: {
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transacción no encontrada',
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'La pasarela no está disponible para conciliar' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getTransaction.execute(id);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Procesa una transacción con tarjeta tokenizada',
    description: 'Usa únicamente tokens de prueba. Nunca envíes número de tarjeta o CVC a este endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Identificador obtenido al crear el checkout' })
  @ApiOkResponse({
    description: 'Pago creado o conciliado',
    schema: {
      example: {
        transactionId: '22559c28-437b-422b-964d-facf72aece33',
        reference: 'TM-1785070944142-9FE498',
        providerTransactionId: 'provider-example-123',
        status: 'APPROVED',
        message: null,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Identificador o cuerpo de la solicitud inválido' })
  @ApiNotFoundResponse({ description: 'Transacción inexistente' })
  @ApiConflictResponse({
    description: 'Pago no disponible o procesado simultáneamente',
    schema: {
      examples: {
        processing: {
          value: {
            code: 'PAYMENT_ALREADY_PROCESSING',
            message: 'El pago ya está siendo procesado',
          },
        },
        unavailable: {
          value: {
            code: 'TRANSACTION_NOT_PAYABLE',
            message: 'La transacción no se encuentra disponible para pago',
          },
        },
      },
    },
  })
  @ApiBadGatewayResponse({
    description: 'La pasarela rechazó la solicitud',
    schema: {
      example: {
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'La pasarela rechazó la solicitud de pago',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'La pasarela no está disponible temporalmente',
  })
  pay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ProcessPaymentDto,
    @Ip() ip: string,
  ) {
    return this.processPayment.execute(id, input, ip);
  }
}
