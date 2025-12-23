import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Service } from './s3.service';
import { ImageFilterService } from './image-filter.service';
import { ImageAssetController } from './image-asset.controller';
import { ImageAssetService } from './image-asset.service';
import { ImageAsset, ImageAssetSchema } from './schemas/image-asset.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: ImageAsset.name, schema: ImageAssetSchema },
    ]),
  ],
  controllers: [UploadController, ImageAssetController],
  providers: [UploadService, S3Service, ImageFilterService, ImageAssetService],
  exports: [UploadService, ImageFilterService, ImageAssetService],
})
export class UploadModule {} 