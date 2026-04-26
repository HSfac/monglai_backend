import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { IStorageProvider, STORAGE_PROVIDER_TOKEN } from './storage.interface';
import { ImageFilterService } from './image-filter.service';

@Injectable()
export class UploadService {
  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private storageProvider: IStorageProvider,
    private imageFilterService: ImageFilterService,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    isAdultVerified: boolean = false,
    isAdultContent: boolean = false,
  ): Promise<string> {
    if (!file) throw new BadRequestException('이미지 파일이 없습니다.');
    if (!file.mimetype.includes('image'))
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('파일 크기는 5MB 이하여야 합니다.');

    try {
      if (isAdultContent) {
        await this.imageFilterService.validateCharacterImage(
          file.buffer,
          isAdultContent,
          isAdultVerified,
        );
      } else {
        await this.imageFilterService.validateProfileImage(
          file.buffer,
          isAdultVerified,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        error.message || '부적절한 이미지가 감지되었습니다.',
      );
    }

    return this.storageProvider.uploadFile(file, 'images');
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) throw new BadRequestException('이미지 URL이 없습니다.');
    return this.storageProvider.deleteFile(imageUrl);
  }

  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    folder?: string,
  ): Promise<{ uploadUrl: string; fileKey: string; fileUrl: string }> {
    if (!fileType.includes('image'))
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    return this.storageProvider.getPresignedUploadUrl(
      fileName,
      fileType,
      folder || 'images',
    );
  }
}
