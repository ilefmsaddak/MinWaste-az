import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

// Charge `MinWaste-Team-merged/.env` puis `backend/.env` (ce dernier écrase)
const cwd = process.cwd();
const envParent = path.join(cwd, '..', '.env');
const envLocal = path.join(cwd, '.env');
if (fs.existsSync(envParent)) loadEnv({ path: envParent });
if (fs.existsSync(envLocal)) loadEnv({ path: envLocal, override: true });
if (!fs.existsSync(envParent) && !fs.existsSync(envLocal)) loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      // multipart/form-data : champs reçus en string → nombres / enums
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
        origin,
      );
      if (isLocalhost) return callback(null, true);
      const extra = process.env.FRONTEND_URL;
      if (extra && origin === extra) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'apollo-require-preflight',
      'x-apollo-operation-name',
      'apollo-query-plan',
    ],
    optionsSuccessStatus: 204,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(
    `🚀 MinWaste merged API running on port ${port} (0.0.0.0)`,
  );
}
bootstrap();
