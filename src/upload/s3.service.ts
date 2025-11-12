import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3: S3;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get<string>('AWS_REGION'),
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'images'): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }

    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read' as const,
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // URL에서 키 추출
    const key = this.extractKeyFromUrl(fileUrl);

    if (!key) {
      throw new Error('Invalid S3 URL');
    }

    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }

    const params = {
      Bucket: bucketName,
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const bucketName = this.configService.get<string>('AWS_S3_BUCKET');

      // URL 형식: https://bucket-name.s3.region.amazonaws.com/key
      if (bucketName && parsedUrl.hostname.includes(bucketName)) {
        return parsedUrl.pathname.substring(1); // 첫 번째 '/' 제거
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Presigned URL 생성 (클라이언트에서 직접 업로드)
   * @param fileName 파일 이름
   * @param fileType 파일 MIME 타입
   * @param folder 폴더명
   * @returns Presigned URL과 파일 키
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    folder: string = 'images',
  ): Promise<{ uploadUrl: string; fileKey: string; fileUrl: string }> {
    // 파일 확장자 추출
    const fileExtension = fileName.split('.').pop();
    const fileKey = `${folder}/${uuidv4()}.${fileExtension}`;

    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_REGION');

    if (!bucketName || !region) {
      throw new Error('AWS S3 configuration is missing');
    }

    const params = {
      Bucket: bucketName,
      Key: fileKey,
      ContentType: fileType,
      ACL: 'public-read' as const,
      Expires: 300, // 5분 유효
    };

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);

    // 최종 파일 URL 생성
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;

    return {
      uploadUrl,
      fileKey,
      fileUrl,
    };
  }

  /**
   * Presigned Download URL 생성 (비공개 파일 다운로드)
   * @param fileKey S3 파일 키
   * @returns Presigned URL
   */
  async getPresignedDownloadUrl(fileKey: string): Promise<string> {
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }

    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Expires: 3600, // 1시간 유효
    };

    return await this.s3.getSignedUrlPromise('getObject', params);
  }
} 