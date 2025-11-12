import { 
  Controller, 
  Post, 
  UseGuards, 
  UseInterceptors, 
  UploadedFile,
  Delete,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('업로드')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('image')
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 업로드' })
  @ApiResponse({ status: 201, description: '이미지 업로드 성공' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.uploadService.uploadImage(file);
    return { imageUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('image')
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 삭제' })
  @ApiResponse({ status: 200, description: '이미지 삭제 성공' })
  async deleteImage(@Body() body: { imageUrl: string }) {
    await this.uploadService.deleteImage(body.imageUrl);
    return { message: '이미지가 삭제되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Presigned Upload URL 생성' })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL 생성 성공',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string' },
        fileKey: { type: 'string' },
        fileUrl: { type: 'string' },
      },
    },
  })
  async getPresignedUploadUrl(@Body() body: { fileName: string; fileType: string }) {
    return this.uploadService.getPresignedUploadUrl(body.fileName, body.fileType);
  }
} 