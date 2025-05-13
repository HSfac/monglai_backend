import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './schemas/chat.schema';
import { AIService } from './ai.service';
import { CharactersService } from '../characters/characters.service';
import { UsersService } from '../users/users.service';
import { AIModel } from '../characters/schemas/character.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    private aiService: AIService,
    private charactersService: CharactersService,
    private usersService: UsersService,
  ) {}

  async create(userId: string, characterId: string, aiModel: AIModel): Promise<Chat> {
    // 캐릭터 존재 확인
    const character = await this.charactersService.findById(characterId);
    
    // 새 채팅 생성
    const newChat = new this.chatModel({
      user: userId,
      character: characterId,
      aiModel: aiModel || character.defaultAIModel,
      messages: [],
    });
    
    return newChat.save();
  }

  async findById(id: string): Promise<Chat> {
    const chat = await this.chatModel.findById(id).exec();
    if (!chat) {
      throw new NotFoundException(`채팅 ID ${id}를 찾을 수 없습니다.`);
    }
    return chat;
  }

  async findByUser(userId: string): Promise<Chat[]> {
    return this.chatModel
      .find({ user: userId })
      .sort({ lastActivity: -1 })
      .exec();
  }

  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
  ): Promise<Chat> {
    // 채팅 조회
    const chat = await this.findById(chatId);
    
    // 권한 확인
    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅에 메시지를 보낼 권한이 없습니다.');
    }
    
    // 캐릭터 조회
    const character = await this.charactersService.findById(chat.character.toString());
    
    // 사용자 조회 (토큰 확인)
    const user = await this.usersService.findById(userId);
    if (user.tokens <= 0) {
      throw new BadRequestException('토큰이 부족합니다. 토큰을 충전해주세요.');
    }
    
    // 사용자 메시지 추가
    chat.messages.push({
      sender: 'user',
      content,
      timestamp: new Date(),
    });
    
    // AI 응답 생성
    const aiResponse = await this.aiService.generateResponse(
      chat.aiModel,
      character,
      chat.messages,
      content,
    );
    
    // AI 메시지 추가
    chat.messages.push({
      sender: 'ai',
      content: aiResponse.content,
      timestamp: new Date(),
      tokensUsed: aiResponse.tokensUsed,
    });
    
    // 토큰 사용량 업데이트
    chat.totalTokensUsed += aiResponse.tokensUsed;
    chat.lastActivity = new Date();
    
    // 토큰 차감 (AI 모델에 따라 다른 비율 적용 가능)
    let tokenCost = 1; // 기본 1토큰
    if (chat.aiModel === AIModel.GPT4 || chat.aiModel === AIModel.CLAUDE3) {
      tokenCost = 1;
    } else if (chat.aiModel === AIModel.MISTRAL) {
      tokenCost = 0.5; // 할인된 토큰 사용
    } else if (chat.aiModel === AIModel.CUSTOM) {
      tokenCost = 2; // 프리미엄 토큰 사용
    }
    
    await this.usersService.useTokens(userId, tokenCost);
    
    // 캐릭터 사용 횟수 증가
    await this.charactersService.incrementUsageCount(chat.character.toString());
    
    // 사용자 대화 횟수 증가 및 레벨 업데이트
    const updatedUser = await this.usersService.findById(userId);
    updatedUser.totalConversations += 1;
    await updatedUser.save();
    
    if (updatedUser.totalConversations === 1000 || updatedUser.totalConversations === 10000) {
      await this.usersService.updateCreatorLevel(userId);
    }
    
    // 채팅 저장
    return chat.save();
  }

  async changeAIModel(chatId: string, userId: string, aiModel: AIModel): Promise<Chat> {
    const chat = await this.findById(chatId);
    
    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 AI 모델을 변경할 권한이 없습니다.');
    }
    
    chat.aiModel = aiModel;
    return chat.save();
  }

  async delete(chatId: string, userId: string): Promise<void> {
    const chat = await this.findById(chatId);
    
    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅을 삭제할 권한이 없습니다.');
    }
    
    await this.chatModel.findByIdAndDelete(chatId).exec();
  }
} 