import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // El ALB actual expone HTTP. Evita que el navegador intente cargar
        // los recursos locales de Swagger mediante un listener HTTPS inexistente.
        // Retirar esta excepción cuando HTTPS quede habilitado.
        'upgrade-insecure-requests': null,
      },
    },
  }));
  app.enableCors({
    // Configuración temporal para diagnosticar CORS en el ambiente desplegado.
    // Restringir al dominio del frontend antes de la publicación definitiva.
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: false,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  const swagger = new DocumentBuilder()
    .setTitle('TUMARKED API')
    .setDescription(
      'API de catálogo, checkout, pagos tokenizados, pedidos e inventario. '
      + 'El ambiente de demostración utiliza exclusivamente datos y tokens de prueba.',
    )
    .setVersion('1.0')
    .addServer(
      'http://tumarked-alb-1877790968.us-east-2.elb.amazonaws.com',
      'Producción',
    )
    .addServer('http://localhost:3000', 'Desarrollo local')
    .addTag('health', 'Disponibilidad del servicio')
    .addTag('products', 'Catálogo e inventario')
    .addTag('checkouts', 'Creación de pedidos pendientes')
    .addTag('transactions', 'Procesamiento y consulta de pagos')
    .addTag('webhooks', 'Eventos servidor a servidor')
    .build();
  SwaggerModule.setup(
    'swagger',
    app,
    SwaggerModule.createDocument(app, swagger),
    {
      customSiteTitle: 'TUMARKED API Docs',
      swaggerOptions: {
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: false,
      },
    },
  );
  await app.listen(config.get<number>('PORT', 3000));
}

void bootstrap();

