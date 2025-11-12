import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Put, Sse, MessageEvent } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AIModel } from '../characters/schemas/character.schema';
import { Observable } from 'rxjs';

@ApiTags('채팅')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '새 채팅 생성' })
  @ApiResponse({ status: 201, description: '채팅 생성 성공' })
  async create(
    @Request() req,
    @Body() createChatDto: { characterId: string; aiModel?: AIModel },
  ) {
    return this.chatService.create(
      req.user.userId,
      createChatDto.characterId,
      createChatDto.aiModel,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 채팅 목록 조회' })
  @ApiResponse({ status: 200, description: '채팅 목록 조회 성공' })
  async findAll(@Request() req) {
    return this.chatService.findByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '채팅 상세 조회' })
  @ApiResponse({ status: 200, description: '채팅 조회 성공' })
  @ApiResponse({ status: 404, description: '채팅을 찾을 수 없음' })
  async findOne(@Param('id') id: string) {
    return this.chatService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: '메시지 전송' })
  @ApiResponse({ status: 200, description: '메시지 전송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() messageDto: { content: string },
  ) {
    return this.chatService.sendMessage(id, req.user.userId, messageDto.content);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/ai-model')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI 모델 변경' })
  @ApiResponse({ status: 200, description: 'AI 모델 변경 성공' })
  async changeAIModel(
    @Request() req,
    @Param('id') id: string,
    @Body() modelDto: { aiModel: AIModel },
  ) {
    return this.chatService.changeAIModel(id, req.user.userId, modelDto.aiModel);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '채팅 삭제' })
  @ApiResponse({ status: 200, description: '채팅 삭제 성공' })
  async remove(@Request() req, @Param('id') id: string) {
    await this.chatService.delete(id, req.user.userId);
    return { message: '채팅이 삭제되었습니다.' };
  }

  @UseGuards(JwtAuthGuard)
  @Sse(':id/stream')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI 스트리밍 응답 (SSE)' })
  @ApiResponse({ status: 200, description: '스트리밍 응답 성공' })
  streamMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() messageDto: { content: string },
  ): Observable<MessageEvent> {
    return this.chatService.sendStreamingMessage(id, req.user.userId, messageDto.content);
  }
} 