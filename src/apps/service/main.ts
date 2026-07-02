import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'body-parser';
import { useContainer } from 'class-validator';
import * as fs from 'fs';
import helmet from 'helmet';
import YAML from 'yaml';
import { LoggerService } from '../../common/infrastructure/logger';
import { AppModule } from './app.module';

function syncSwagger(app: INestApplication, document: OpenAPIObject): void {
  if (process.env.NODE_ENV === 'local') {
    const dir = './openapi';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Convert OpenAPI document to YAML string
    const yamlString = YAML.stringify(document);
    fs.writeFileSync('./openapi/auth-service.yaml', yamlString);
  }
  SwaggerModule.setup('docs', app, document);
}

function setupSwagger(app: INestApplication): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle('Auth & User Management API')
    .setDescription('REST API for authentication and user management')
    .setVersion('1.0')
    .addServer('http://localhost:9000', 'local development')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, options);
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.NODE_PORT || 9000;

  // Setup Swagger documentation
  if (/^local/.test(process.env.NODE_ENV || 'local')) {
    const swaggerSpec = setupSwagger(app);
    syncSwagger(app, swaggerSpec);
  }

  const logger = app.get<LoggerService>(LoggerService);

  // Body parser with larger limits. Preserve raw body for webhook signature verification.
  app.use(
    json({
      limit: '50mb',
      verify: (req: object, _res: object, buf: Buffer) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // CORS
  app.enableCors();

  // Security headers
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable dependency injection for class-validator
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  logger.info(`Listening on port: ${port}.... 🚢`);
  logger.info(`API Documentation: http://localhost:${port}/docs`);
  await app.listen(port);
}
