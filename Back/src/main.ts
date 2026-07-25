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
  app.use(helmet());
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN', 'http://localhost:5173') });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  const swagger = new DocumentBuilder().setTitle('TUMARKED API').setVersion('1.0').build();
  SwaggerModule.setup('swagger', app, SwaggerModule.createDocument(app, swagger));
  await app.listen(config.get<number>('PORT', 3000));
}

void bootstrap();

