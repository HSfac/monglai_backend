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
  async findAll(@Query('query') query: string) {
    if (query) {
      return this.charactersService.search(query);
    }
    return this.charactersService.findAll();
  }

  @Get('popular')
  @ApiOperation({ summary: '인기 캐릭터 목록 조회' })
  @ApiResponse({ status: 200, description: '인기 캐릭터 조회 성공' })
  async getPopular() {
    return this.charactersService.getPopular();
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
} 