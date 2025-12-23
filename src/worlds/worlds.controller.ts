import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorldsService } from './worlds.service';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { Visibility } from '../characters/schemas/character.schema';

@ApiTags('worlds')
@Controller('worlds')
export class WorldsController {
  constructor(private readonly worldsService: WorldsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '세계관 생성' })
  @ApiResponse({ status: 201, description: '세계관이 생성되었습니다.' })
  async create(@Body() createWorldDto: CreateWorldDto, @Request() req) {
    return this.worldsService.create(createWorldDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: '세계관 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: '세계관 목록' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tags') tags?: string | string[],
    @Query('search') search?: string,
  ) {
    const tagsArray = tags
      ? Array.isArray(tags)
        ? tags
        : [tags]
      : undefined;

    return this.worldsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      tags: tagsArray,
      search,
      visibility: Visibility.PUBLIC,
    });
  }

  @Get('popular')
  @ApiOperation({ summary: '인기 세계관 목록' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '인기 세계관 목록' })
  async getPopular(@Query('limit') limit?: number) {
    return this.worldsService.getPopular(limit ? Number(limit) : 10);
  }

  @Get('tags/popular')
  @ApiOperation({ summary: '인기 태그 목록' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '인기 태그 목록' })
  async getPopularTags(@Query('limit') limit?: number) {
    return this.worldsService.getPopularTags(limit ? Number(limit) : 20);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내가 만든 세계관 목록' })
  @ApiResponse({ status: 200, description: '내 세계관 목록' })
  async findMyWorlds(@Request() req) {
    return this.worldsService.findByCreator(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '세계관 상세 조회' })
  @ApiResponse({ status: 200, description: '세계관 정보' })
  @ApiResponse({ status: 404, description: '세계관을 찾을 수 없습니다.' })
  async findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.userId;
    return this.worldsService.findOne(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '세계관 수정' })
  @ApiResponse({ status: 200, description: '세계관이 수정되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '세계관을 찾을 수 없습니다.' })
  async update(
    @Param('id') id: string,
    @Body() updateWorldDto: UpdateWorldDto,
    @Request() req,
  ) {
    return this.worldsService.update(id, updateWorldDto, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '세계관 삭제' })
  @ApiResponse({ status: 200, description: '세계관이 삭제되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '세계관을 찾을 수 없습니다.' })
  async remove(@Param('id') id: string, @Request() req) {
    await this.worldsService.remove(id, req.user.userId);
    return { message: '세계관이 삭제되었습니다.' };
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '세계관 좋아요' })
  @ApiResponse({ status: 200, description: '좋아요가 추가되었습니다.' })
  async like(@Param('id') id: string) {
    return this.worldsService.like(id);
  }
}
