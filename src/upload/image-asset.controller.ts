import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageAssetService, CreateImageAssetDto } from './image-asset.service';
import { ImageAssetType } from './schemas/image-asset.schema';

@ApiTags('이미지 자산')
@Controller('image-assets')
export class ImageAssetController {
  constructor(private readonly imageAssetService: ImageAssetService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 업로드 및 자산 등록' })
  @ApiResponse({ status: 201, description: '이미지가 업로드되었습니다.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        worldId: { type: 'string' },
        characterId: { type: 'string' },
        presetId: { type: 'string' },
        type: { type: 'string', enum: Object.values(ImageAssetType) },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        isAdultContent: { type: 'boolean' },
      },
      required: ['image', 'type'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Request() req,
  ) {
    const dto: CreateImageAssetDto = {
      worldId: body.worldId,
      characterId: body.characterId,
      presetId: body.presetId,
      type: body.type || ImageAssetType.OTHER,
      tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
      description: body.description,
      isAdultContent: body.isAdultContent === 'true' || body.isAdultContent === true,
    };

    return this.imageAssetService.uploadAndCreateAsset(
      file,
      req.user.userId,
      dto,
      req.user.isAdultVerified || false,
    );
  }

  @Get('slot-usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 슬롯 사용량 조회' })
  @ApiQuery({ name: 'characterId', required: false })
  @ApiQuery({ name: 'worldId', required: false })
  @ApiResponse({ status: 200, description: '슬롯 사용량' })
  async getSlotUsage(
    @Query('characterId') characterId?: string,
    @Query('worldId') worldId?: string,
    @Request() req?,
  ) {
    return this.imageAssetService.getSlotUsage(
      req.user.userId,
      characterId,
      worldId,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 이미지 자산 목록' })
  @ApiQuery({ name: 'type', required: false, enum: ImageAssetType })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: '이미지 자산 목록' })
  async getMyAssets(
    @Query('type') type?: ImageAssetType,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?,
  ) {
    return this.imageAssetService.findByOwner(req.user.userId, {
      type,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('character/:characterId')
  @ApiOperation({ summary: '캐릭터의 이미지 자산 목록' })
  @ApiResponse({ status: 200, description: '이미지 자산 목록' })
  async getCharacterAssets(@Param('characterId') characterId: string) {
    return this.imageAssetService.findByCharacter(characterId);
  }

  @Get('world/:worldId')
  @ApiOperation({ summary: '세계관의 이미지 자산 목록' })
  @ApiResponse({ status: 200, description: '이미지 자산 목록' })
  async getWorldAssets(@Param('worldId') worldId: string) {
    return this.imageAssetService.findByWorld(worldId);
  }

  @Get(':id')
  @ApiOperation({ summary: '이미지 자산 상세 조회' })
  @ApiResponse({ status: 200, description: '이미지 자산 정보' })
  @ApiResponse({ status: 404, description: '이미지를 찾을 수 없습니다.' })
  async getAsset(@Param('id') id: string) {
    return this.imageAssetService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 자산 수정' })
  @ApiResponse({ status: 200, description: '이미지 자산이 수정되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '이미지를 찾을 수 없습니다.' })
  async updateAsset(
    @Param('id') id: string,
    @Body() body: { tags?: string[]; description?: string; type?: ImageAssetType },
    @Request() req,
  ) {
    return this.imageAssetService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이미지 자산 삭제' })
  @ApiResponse({ status: 200, description: '이미지가 삭제되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '이미지를 찾을 수 없습니다.' })
  async deleteAsset(@Param('id') id: string, @Request() req) {
    await this.imageAssetService.remove(id, req.user.userId);
    return { message: '이미지가 삭제되었습니다.' };
  }
}
