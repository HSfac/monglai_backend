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
    
    const params = {
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
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

    const params = {
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
      
      // URL 형식: https://bucket-name.s3.region.amazonaws.com/key
      if (parsedUrl.hostname.includes(bucketName)) {
        return parsedUrl.pathname.substring(1); // 첫 번째 '/' 제거
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
} 