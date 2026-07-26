import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions.use-case';
import { ProcessPaymentUseCase } from '../application/use-cases/process-payment.use-case';
import { GetTransactionUseCase } from '../application/use-cases/get-transaction.use-case';
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
  @ApiOperation({ summary: 'Lista los pedidos recientes con datos personales enmascarados' })
  findAll() {
    return this.listTransactions.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta y concilia el estado de una transacción' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getTransaction.execute(id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Procesa una transacción con token de tarjeta' })
  pay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ProcessPaymentDto,
    @Ip() ip: string,
  ) {
    return this.processPayment.execute(id, input, ip);
  }
}
