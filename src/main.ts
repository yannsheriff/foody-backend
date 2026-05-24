import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

const server: express.Express = express();

let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Foody API')
    .setDescription("API de l'application Foody")
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.init();

  if (!process.env.VERCEL) {
    await app.listen(process.env.PORT ?? 3000);
  }
}

function getInitPromise(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

// Kick off init at module load so the cold-start latency is paid here
getInitPromise();

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  await getInitPromise();
  server(req, res);
}
