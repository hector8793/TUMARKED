import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions.use-case';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly listTransactions: ListTransactionsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Lista los pedidos recientes con datos personales enmascarados' })
  findAll() {
    return this.listTransactions.execute();
  }
}

