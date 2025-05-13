import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from './s3.service';

@Injectable()
export class UploadService {
  constructor(private s3Service: S3Service) {}

  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('이미지 파일이 없습니다.');
    }

    // 이미지 파일 타입 검증
    if (!file.mimetype.includes('image')) {
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('파일 크기는 5MB 이하여야 합니다.');
    }

    return this.s3Service.uploadFile(file, 'images');
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) {
      throw new BadRequestException('이미지 URL이 없습니다.');
    }

    return this.s3Service.deleteFile(imageUrl);
  }
} 