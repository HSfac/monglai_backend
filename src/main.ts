import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // bodyParser: false 로 직접 제어
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Body parsers (순서 중요 — /upload/local 은 raw 바이너리로 처리)
  app.use('/upload/local', express.raw({ type: '*/*', limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 로컬 스토리지 정적 파일 서빙
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // CORS 설정
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://monglai.vercel.app',
    'https://www.monglai.com',
    'https://monglai.com',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // 개발 환경이거나 허용된 origin인 경우
      if (
        !origin ||
        process.env.NODE_ENV === 'development' ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
  });

  // 전역 필터 설정 (에러 핸들링)
  app.useGlobalFilters(new HttpExceptionFilter());

  // 전역 인터셉터 설정 (응답 변환)
  app.useGlobalInterceptors(new TransformInterceptor());

  // 전역 파이프 설정 (유효성 검사)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('몽글AI API')
    .setDescription('몽글AI 웹앱을 위한 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 5001;
  await app.listen(port);
  logger.log(`🚀 Server is running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
