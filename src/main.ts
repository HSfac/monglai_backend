import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정
  app.enableCors();
  
  // 전역 파이프 설정
  app.useGlobalPipes(new ValidationPipe());
  
  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('몽글AI API')
    .setDescription('몽글AI 웹앱을 위한 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  await app.listen(3000);
}
bootstrap(); 