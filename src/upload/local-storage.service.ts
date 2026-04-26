import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageProvider } from './storage.interface';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageProvider {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.baseUrl =
      this.configService.get<string>('API_URL') || 'http://localhost:5001';

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'images',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    return `${this.baseUrl}/uploads/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const filename = fileUrl.split('/').pop();
    if (!filename) return;
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    _folder: string = 'images',
  ): Promise<{ uploadUrl: string; fileKey: string; fileUrl: string }> {
    const ext = fileName.split('.').pop();
    const fileKey = `${uuidv4()}.${ext}`;
    const uploadUrl = `${this.baseUrl}/upload/local/${fileKey}`;
    const fileUrl = `${this.baseUrl}/uploads/${fileKey}`;
    return { uploadUrl, fileKey, fileUrl };
  }

  // 로컬 PUT 요청 수신 후 파일 저장
  saveLocalUpload(filename: string, buffer: Buffer): void {
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
  }
}
