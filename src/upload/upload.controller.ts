import {
  Controller,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  Optional,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { LocalStorageService } from './local-storage.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { GetPresignedUrlDto, DeleteImageDto } from './dto/presigned-url.dto';
import { Request } from 'express';
import { STORAGE_PROVIDER_TOKEN } from './storage.interface';

@ApiTags('업로드')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    @Optional()
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: any,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('image')
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 업로드' })
  @ApiResponse({ status: 201, description: '이미지 업로드 성공' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
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
  async deleteImage(@Body() body: DeleteImageDto) {
    await this.uploadService.deleteImage(body.imageUrl);
    return { message: '이미지가 삭제되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Presigned Upload URL 생성 (로컬/S3 자동 선택)' })
  @ApiResponse({ status: 201, description: 'URL 생성 성공' })
  async getPresignedUploadUrl(@Body() body: GetPresignedUrlDto) {
    return this.uploadService.getPresignedUploadUrl(
      body.fileName,
      body.fileType,
      body.folder,
    );
  }

  // 로컬 스토리지 전용 PUT 엔드포인트 (S3 presigned URL 흐름을 로컬에서 모사)
  @Put('local/:filename')
  @ApiOperation({ summary: '로컬 파일 업로드 수신 (개발용)' })
  async receiveLocalUpload(
    @Param('filename') filename: string,
    @Req() req: Request,
  ) {
    if (!(this.storageProvider instanceof LocalStorageService)) {
      return { ok: true }; // S3 모드에서는 이 경로가 호출되지 않음
    }
    const buffer: Buffer = req.body as Buffer;
    this.storageProvider.saveLocalUpload(filename, buffer);
    return { ok: true };
  }
}
