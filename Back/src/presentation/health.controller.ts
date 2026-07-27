import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Verifica que la API está disponible' })
  @ApiOkResponse({
    description: 'Servicio saludable',
    schema: {
      example: { status: 'ok', timestamp: '2026-07-27T12:00:00.000Z' },
    },
  })
  check() { return { status: 'ok', timestamp: new Date().toISOString() }; }
}
