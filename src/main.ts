import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const dataDir = path.resolve('./data');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('数据采集后端服务')
    .setDescription('面向移动采集App和网页录入端的统一接入服务')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`数据采集服务已启动: http://localhost:${port}`);
  console.log(`API文档地址: http://localhost:${port}/api/docs`);
}
bootstrap();
