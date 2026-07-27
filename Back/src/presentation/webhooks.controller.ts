import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  HandlePaymentEventUseCase,
  PaymentEventPayload,
} from '../application/use-cases/handle-payment-event.use-case';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly handleEvent: HandlePaymentEventUseCase) {}

  @Post('payment-provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recibe eventos firmados de la pasarela',
    description: 'Endpoint servidor a servidor. Valida la firma, el monto y la idempotencia del evento.',
  })
  @ApiHeader({
    name: 'x-event-checksum',
    required: false,
    description: 'Checksum firmado. También puede recibirse dentro del payload.',
    example: 'checksum_test_example',
  })
  @ApiBody({
    schema: {
      example: {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: 'provider-example-123',
            reference: 'TM-1785070944142-9FE498',
            status: 'APPROVED',
            amount_in_cents: 20690000,
            payment_method_type: 'CARD',
          },
        },
        timestamp: 1785071449,
        signature: {
          properties: [
            'transaction.id',
            'transaction.status',
            'transaction.amount_in_cents',
          ],
          checksum: 'checksum_test_example',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Evento recibido',
    schema: {
      examples: {
        processed: { value: { received: true, processed: true } },
        duplicate: {
          value: { received: true, processed: true, duplicate: true },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Evento incompleto, monto incorrecto o transacción inexistente',
  })
  @ApiUnauthorizedResponse({ description: 'Firma del evento inválida' })
  receive(
    @Body() payload: PaymentEventPayload,
    @Headers('x-event-checksum') checksum?: string,
  ) {
    return this.handleEvent.execute(payload, checksum);
  }
}
