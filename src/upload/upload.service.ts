import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ImageFilterService } from './image-filter.service';

@Injectable()
export class UploadService {
  constructor(
    private s3Service: S3Service,
    private imageFilterService: ImageFilterService,
  ) {}

  /**
   * 이미지 업로드 (NSFW 필터 적용)
   * @param file 업로드할 이미지 파일
   * @param isAdultVerified 성인인증 여부
   * @param isAdultContent 성인 콘텐츠 여부 (캐릭터 이미지용)
   */
  async uploadImage(
    file: Express.Multer.File,
    isAdultVerified: boolean = false,
    isAdultContent: boolean = false,
  ): Promise<string> {
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

    // NSFW 이미지 체크
    try {
      if (isAdultContent) {
        // 캐릭터 이미지는 별도 검증
        await this.imageFilterService.validateCharacterImage(
          file.buffer,
          isAdultContent,
          isAdultVerified,
        );
      } else {
        // 프로필 이미지는 기본 검증
        await this.imageFilterService.validateProfileImage(file.buffer, isAdultVerified);
      }
    } catch (error) {
      // NSFW 체크 실패 시 업로드 차단
      throw new BadRequestException(error.message || '부적절한 이미지가 감지되었습니다.');
    }

    return this.s3Service.uploadFile(file, 'images');
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) {
      throw new BadRequestException('이미지 URL이 없습니다.');
    }

    return this.s3Service.deleteFile(imageUrl);
  }

  /**
   * Presigned Upload URL 생성
   * 클라이언트에서 직접 S3에 업로드할 수 있는 URL 발급
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    folder?: string,
  ): Promise<{ uploadUrl: string; fileKey: string; fileUrl: string }> {
    // 이미지 파일 타입 검증
    if (!fileType.includes('image')) {
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    }

    return this.s3Service.getPresignedUploadUrl(fileName, fileType, folder || 'images');
  }
} 