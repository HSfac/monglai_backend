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
import { MemoryService } from './memory.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@ApiTags('memory')
@Controller()
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  // ==================== 메모리 요약 ====================

  @Get('chat/:chatId/memory')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '채팅의 메모리 요약 목록' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '메모리 요약 목록' })
  async getMemorySummaries(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: number,
  ) {
    return this.memoryService.getMemorySummaries(
      chatId,
      limit ? Number(limit) : 5,
    );
  }

  @Get('chat/:chatId/memory/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '메모리 통계' })
  @ApiResponse({ status: 200, description: '메모리 통계 정보' })
  async getMemoryStats(@Param('chatId') chatId: string) {
    return this.memoryService.getMemoryStatsForSession(chatId);
  }

  // ==================== 유저 노트 ====================

  @Post('notes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '노트 생성' })
  @ApiResponse({ status: 201, description: '노트가 생성되었습니다.' })
  async createNote(@Body() createNoteDto: CreateNoteDto, @Request() req) {
    return this.memoryService.createNote(createNoteDto, req.user.userId);
  }

  @Get('chat/:chatId/notes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '채팅의 노트 목록' })
  @ApiResponse({ status: 200, description: '노트 목록' })
  async getNotesBySession(@Param('chatId') chatId: string, @Request() req) {
    return this.memoryService.getNotesBySession(chatId, req.user.userId);
  }

  @Get('characters/:characterId/notes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '캐릭터의 노트 목록' })
  @ApiResponse({ status: 200, description: '노트 목록' })
  async getNotesByCharacter(
    @Param('characterId') characterId: string,
    @Request() req,
  ) {
    return this.memoryService.getNotesByCharacter(characterId, req.user.userId);
  }

  @Get('notes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '노트 상세 조회' })
  @ApiResponse({ status: 200, description: '노트 정보' })
  @ApiResponse({ status: 404, description: '노트를 찾을 수 없습니다.' })
  async findNoteById(@Param('id') id: string) {
    return this.memoryService.findNoteById(id);
  }

  @Put('notes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '노트 수정' })
  @ApiResponse({ status: 200, description: '노트가 수정되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '노트를 찾을 수 없습니다.' })
  async updateNote(
    @Param('id') id: string,
    @Body() updateNoteDto: UpdateNoteDto,
    @Request() req,
  ) {
    return this.memoryService.updateNote(id, updateNoteDto, req.user.userId);
  }

  @Delete('notes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '노트 삭제' })
  @ApiResponse({ status: 200, description: '노트가 삭제되었습니다.' })
  @ApiResponse({ status: 403, description: '권한이 없습니다.' })
  @ApiResponse({ status: 404, description: '노트를 찾을 수 없습니다.' })
  async deleteNote(@Param('id') id: string, @Request() req) {
    await this.memoryService.deleteNote(id, req.user.userId);
    return { message: '노트가 삭제되었습니다.' };
  }

  @Post('notes/:id/toggle-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '노트 고정 토글' })
  @ApiResponse({ status: 200, description: '고정 상태가 변경되었습니다.' })
  async togglePin(@Param('id') id: string, @Request() req) {
    return this.memoryService.togglePinNote(id, req.user.userId);
  }

  @Post('notes/:id/toggle-context')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '컨텍스트 포함 토글' })
  @ApiResponse({ status: 200, description: '컨텍스트 포함 상태가 변경되었습니다.' })
  async toggleContext(@Param('id') id: string, @Request() req) {
    return this.memoryService.toggleIncludeInContext(id, req.user.userId);
  }
}
