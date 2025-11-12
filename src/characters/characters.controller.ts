import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('캐릭터')
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '새 캐릭터 생성' })
  @ApiResponse({ status: 201, description: '캐릭터 생성 성공' })
  async create(@Request() req, @Body() createCharacterDto: any) {
    return this.charactersService.create(req.user.userId, createCharacterDto);
  }

  @Get()
  @ApiOperation({ summary: '공개 캐릭터 목록 조회' })
  @ApiResponse({ status: 200, description: '캐릭터 목록 조회 성공' })
  async findAll(
    @Query('query') query: string,
    @Query('tags') tags: string,
  ) {
    // 태그 검색
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      return this.charactersService.searchByTags(tagArray);
    }

    // 텍스트 검색
    if (query) {
      return this.charactersService.search(query);
    }

    return this.charactersService.findAll();
  }

  @Get('tags/popular')
  @ApiOperation({ summary: '인기 태그 목록 조회' })
  @ApiResponse({ status: 200, description: '인기 태그 조회 성공' })
  async getPopularTags(@Query('limit') limit?: number) {
    return this.charactersService.getPopularTags(limit || 20);
  }

  @Get('popular')
  @ApiOperation({ summary: '인기 캐릭터 목록 조회' })
  @ApiResponse({ status: 200, description: '인기 캐릭터 조회 성공' })
  async getPopular() {
    return this.charactersService.getPopular();
  }

  @Get('leaderboard/ranking')
  @ApiOperation({ summary: '캐릭터 인기 순위 리더보드' })
  @ApiResponse({ status: 200, description: '리더보드 조회 성공' })
  async getLeaderboard(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'all-time',
    @Query('limit') limit?: number,
  ) {
    return this.charactersService.getLeaderboard(period || 'all-time', limit || 50);
  }

  @Get(':id')
  @ApiOperation({ summary: '캐릭터 상세 조회' })
  @ApiResponse({ status: 200, description: '캐릭터 조회 성공' })
  @ApiResponse({ status: 404, description: '캐릭터를 찾을 수 없음' })
  async findOne(@Param('id') id: string) {
    return this.charactersService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '캐릭터 수정' })
  @ApiResponse({ status: 200, description: '캐릭터 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateCharacterDto: any,
  ) {
    return this.charactersService.update(id, req.user.userId, updateCharacterDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '캐릭터 삭제' })
  @ApiResponse({ status: 200, description: '캐릭터 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async remove(@Request() req, @Param('id') id: string) {
    await this.charactersService.delete(id, req.user.userId);
    return { message: '캐릭터가 삭제되었습니다.' };
  }

  @Post(':id/like')
  @ApiOperation({ summary: '캐릭터 좋아요' })
  @ApiResponse({ status: 200, description: '좋아요 성공' })
  async like(@Param('id') id: string) {
    return this.charactersService.like(id);
  }

  // ==================== 크리에이터 대시보드 API ====================

  @UseGuards(JwtAuthGuard)
  @Get('creator/my-characters')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내가 생성한 캐릭터 목록' })
  @ApiResponse({ status: 200, description: '캐릭터 목록 조회 성공' })
  async getMyCharacters(@Request() req) {
    return this.charactersService.findByCreator(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('creator/earnings')
  @ApiBearerAuth()
  @ApiOperation({ summary: '크리에이터 수익 조회' })
  @ApiResponse({ status: 200, description: '수익 조회 성공' })
  async getCreatorEarnings(@Request() req, @Query('period') period?: string) {
    return this.charactersService.getCreatorEarnings(req.user.userId, period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('creator/dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: '크리에이터 대시보드 통계' })
  @ApiResponse({ status: 200, description: '대시보드 통계 조회 성공' })
  async getCreatorDashboard(@Request() req) {
    const characters = await this.charactersService.findByCreator(req.user.userId);
    const earnings = await this.charactersService.getCreatorEarnings(req.user.userId);

    const totalUsage = characters.reduce((sum, char) => sum + char.usageCount, 0);
    const totalLikes = characters.reduce((sum, char) => sum + char.likes, 0);

    return {
      characters: {
        total: characters.length,
        list: characters,
      },
      stats: {
        totalUsage,
        totalLikes,
        totalEarnings: earnings.totalEarnings,
        totalConversations: earnings.totalConversations,
      },
      earnings: earnings.earnings,
    };
  }
} 