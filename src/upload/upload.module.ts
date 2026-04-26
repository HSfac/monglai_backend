import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Service } from './s3.service';
import { LocalStorageService } from './local-storage.service';
import { ImageFilterService } from './image-filter.service';
import { ImageAssetController } from './image-asset.controller';
import { ImageAssetService } from './image-asset.service';
import { ImageAsset, ImageAssetSchema } from './schemas/image-asset.schema';
import { STORAGE_PROVIDER_TOKEN } from './storage.interface';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: ImageAsset.name, schema: ImageAssetSchema },
    ]),
  ],
  controllers: [UploadController, ImageAssetController],
  providers: [
    S3Service,
    LocalStorageService,
    ImageFilterService,
    ImageAssetService,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, s3: S3Service, local: LocalStorageService) => {
        const provider = config.get<string>('STORAGE_PROVIDER') || 's3';
        return provider === 'local' ? local : s3;
      },
      inject: [ConfigService, S3Service, LocalStorageService],
    },
    UploadService,
  ],
  exports: [UploadService, ImageFilterService, ImageAssetService, STORAGE_PROVIDER_TOKEN],
})
export class UploadModule {}
