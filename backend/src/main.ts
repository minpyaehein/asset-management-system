import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: [
      config.get<string>("FRONTEND_URL") ?? "http://localhost:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Accept",
      "Content-Type",
      "Authorization",
      "X-User-Id",
    ],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(config.get<string>("PORT") ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`Backend running at http://localhost:${port}`);
}

void bootstrap();
