import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
  HandlePaymentEventUseCase, PaymentEventPayload,
} from '../application/use-cases/handle-payment-event.use-case';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly handleEvent: HandlePaymentEventUseCase) {}

  @Post('payment-provider')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receive(
    @Body() payload: PaymentEventPayload,
    @Headers('x-event-checksum') checksum?: string,
  ) {
    return this.handleEvent.execute(payload, checksum);
  }
}
