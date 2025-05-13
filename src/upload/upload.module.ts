import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Service } from './s3.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [UploadService, S3Service],
  exports: [UploadService],
})
export class UploadModule {} 