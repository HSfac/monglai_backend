import { Injectable, NotFoundException, BadRequestException, MessageEvent } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './schemas/chat.schema';
import { AIService } from './ai.service';
import { CharactersService } from '../characters/characters.service';
import { UsersService } from '../users/users.service';
import { ContentFilterService } from './content-filter.service';
import { AIModel } from '../characters/schemas/character.schema';
import { Observable } from 'rxjs';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    private aiService: AIService,
    private charactersService: CharactersService,
    private usersService: UsersService,
    private contentFilterService: ContentFilterService,
  ) {}

  async create(userId: string, characterId: string, aiModel?: AIModel): Promise<Chat> {
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

    // 토큰 부족 확인 (구독자도 토큰 필요)
    if (user.tokens <= 0) {
      throw new BadRequestException('토큰이 부족합니다. 토큰을 충전해주세요.');
    }

    // 콘텐츠 필터링 (OpenAI Moderation API + 키워드 필터)
    const contentCheck = await this.contentFilterService.checkContent(content, user.isAdultVerified);
    if (contentCheck.isInappropriate) {
      throw new BadRequestException(contentCheck.reason || '부적절한 내용이 포함되어 있습니다.');
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

    // AI 응답 콘텐츠 필터링
    const aiResponseCheck = await this.contentFilterService.checkAIResponse(
      aiResponse.content,
      user.isAdultVerified,
    );
    if (aiResponseCheck.isInappropriate) {
      throw new BadRequestException('AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.');
    }

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

    // 토큰 차감 (AI 모델에 따라 다른 비율 적용)
    let tokenCost = 1; // 기본 1토큰
    if (chat.aiModel === AIModel.GPT4 || chat.aiModel === AIModel.CLAUDE3) {
      tokenCost = 1;
    } else if (chat.aiModel === AIModel.GROK) {
      tokenCost = 0.5; // 할인된 토큰 사용
    } else if (chat.aiModel === AIModel.CUSTOM) {
      tokenCost = 2; // 프리미엄 토큰 사용
    }

    // 모든 사용자 토큰 차감 (구독자 무제한 대화 제거)
    await this.usersService.useTokens(userId, tokenCost);

    // 캐릭터 사용 횟수 증가
    await this.charactersService.incrementUsageCount(chat.character.toString());

    // 크리에이터 수익 기록 (구독자도 포함 - 수익은 배분됨)
    await this.charactersService.recordCreatorEarning(chat.character.toString(), tokenCost);
    
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

  /**
   * 스트리밍 메시지 전송 (실시간 응답)
   */
  sendStreamingMessage(
    chatId: string,
    userId: string,
    content: string,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      (async () => {
        try {
          // 채팅 조회
          const chat = await this.findById(chatId);

          // 권한 확인
          if (chat.user.toString() !== userId) {
            observer.error(new BadRequestException('이 채팅에 메시지를 보낼 권한이 없습니다.'));
            return;
          }

          // 캐릭터 조회
          const character = await this.charactersService.findById(chat.character.toString());

          // 사용자 조회 (토큰 확인)
          const user = await this.usersService.findById(userId);

          // 토큰 부족 확인 (구독자도 토큰 필요)
          if (user.tokens <= 0) {
            observer.error(new BadRequestException('토큰이 부족합니다. 토큰을 충전해주세요.'));
            return;
          }

          // 콘텐츠 필터링 (OpenAI Moderation API + 키워드 필터)
          const contentCheck = await this.contentFilterService.checkContent(content, user.isAdultVerified);
          if (contentCheck.isInappropriate) {
            observer.error(new BadRequestException(contentCheck.reason || '부적절한 내용이 포함되어 있습니다.'));
            return;
          }

          // 사용자 메시지 추가
          chat.messages.push({
            sender: 'user',
            content,
            timestamp: new Date(),
          });

          // 전체 응답 내용을 누적하기 위한 변수
          let fullResponse = '';

          // AI 스트리밍 응답 생성
          const { totalTokensUsed } = await this.aiService.generateStreamingResponse(
            chat.aiModel,
            character,
            chat.messages,
            content,
            (chunk: string) => {
              // 각 청크를 클라이언트로 전송
              fullResponse += chunk;
              observer.next({
                data: JSON.stringify({
                  type: 'chunk',
                  content: chunk
                }),
              } as MessageEvent);
            },
          );

          // AI 응답 콘텐츠 필터링
          const aiResponseCheck = this.contentFilterService.checkAIResponse(
            fullResponse,
            user.isAdultVerified,
          );
          if (aiResponseCheck.isInappropriate) {
            observer.error(new BadRequestException('AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.'));
            return;
          }

          // AI 메시지 추가
          chat.messages.push({
            sender: 'ai',
            content: fullResponse,
            timestamp: new Date(),
            tokensUsed: totalTokensUsed,
          });

          // 토큰 사용량 업데이트
          chat.totalTokensUsed += totalTokensUsed;
          chat.lastActivity = new Date();

          // 토큰 차감 (AI 모델에 따라 다른 비율 적용)
          let tokenCost = 1; // 기본 1토큰
          if (chat.aiModel === AIModel.GPT4 || chat.aiModel === AIModel.CLAUDE3) {
            tokenCost = 1;
          } else if (chat.aiModel === AIModel.GROK) {
            tokenCost = 0.5; // 할인된 토큰 사용
          } else if (chat.aiModel === AIModel.CUSTOM) {
            tokenCost = 2; // 프리미엄 토큰 사용
          }

          // 모든 사용자 토큰 차감 (구독자 무제한 대화 제거)
          await this.usersService.useTokens(userId, tokenCost);

          // 캐릭터 사용 횟수 증가
          await this.charactersService.incrementUsageCount(chat.character.toString());

          // 크리에이터 수익 기록 (구독자도 포함 - 수익은 배분됨)
          await this.charactersService.recordCreatorEarning(chat.character.toString(), tokenCost);

          // 사용자 대화 횟수 증가 및 레벨 업데이트
          const updatedUser = await this.usersService.findById(userId);
          updatedUser.totalConversations += 1;
          await updatedUser.save();

          if (updatedUser.totalConversations === 1000 || updatedUser.totalConversations === 10000) {
            await this.usersService.updateCreatorLevel(userId);
          }

          // 채팅 저장
          await chat.save();

          // 스트리밍 완료 신호 전송
          observer.next({
            data: JSON.stringify({
              type: 'done',
              tokensUsed: totalTokensUsed,
              tokenCost,
            }),
          } as MessageEvent);

          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      })();
    });
  }
} 