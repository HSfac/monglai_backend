export interface IStorageProvider {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    folder?: string,
  ): Promise<{ uploadUrl: string; fileKey: string; fileUrl: string }>;
}

export const STORAGE_PROVIDER_TOKEN = 'STORAGE_PROVIDER';
