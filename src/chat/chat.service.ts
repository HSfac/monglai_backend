import { Injectable, NotFoundException, BadRequestException, MessageEvent, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatMode, EmbeddedSessionState } from './schemas/chat.schema';
import { AIService } from './ai.service';
import { CharactersService } from '../characters/characters.service';
import { UsersService } from '../users/users.service';
import { ContentFilterService } from './content-filter.service';
import { ContextBuilderService } from './services/context-builder.service';
import { AIModel } from '../characters/schemas/character.schema';
import { MemorySummary } from '../memory/schemas/memory-summary.schema';
import { Observable } from 'rxjs';
import { UpdateSessionStateDto } from './dto/update-session-state.dto';

export interface CreateChatOptions {
  aiModel?: AIModel;
  presetId?: string;
  mode?: ChatMode;
  title?: string;
}

// 메모리 요약 트리거 기준 메시지 수
const MEMORY_SUMMARY_TRIGGER_COUNT = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(MemorySummary.name) private memorySummaryModel: Model<MemorySummary>,
    private aiService: AIService,
    private charactersService: CharactersService,
    private usersService: UsersService,
    private contentFilterService: ContentFilterService,
    private contextBuilderService: ContextBuilderService,
  ) {}

  async create(userId: string, characterId: string, options?: CreateChatOptions): Promise<Chat> {
    // 캐릭터 존재 확인
    const character = await this.charactersService.findById(characterId);

    // 새 채팅 생성
    const newChat = new this.chatModel({
      user: userId,
      character: characterId,
      aiModel: options?.aiModel || character.defaultAIModel,
      messages: [],
      presetId: options?.presetId ? new Types.ObjectId(options.presetId) : undefined,
      mode: options?.mode || ChatMode.CHAT,
      title: options?.title,
      sessionState: {
        mood: '평온',
        relationshipLevel: 0,
        scene: '',
        progressCounter: 1,
        lastSceneSummary: '',
      },
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

  /**
   * 모델별 가변 토큰 비용 계산
   * - 각 AI 모델의 실제 API 비용을 반영
   * - 응답 길이에 따른 추가 비용 적용
   */
  private calculateTokenCost(
    aiModel: AIModel,
    apiTokensUsed: number,
    responseLength: number,
  ): number {
    // 모델별 기본 비용 (1000 API 토큰당 앱 내 토큰 비용)
    const MODEL_COSTS: Record<string, number> = {
      [AIModel.GPT4]: 1.5, // GPT-4는 비용이 높음
      [AIModel.CLAUDE3]: 1.5, // Claude 3도 GPT-4와 유사
      [AIModel.GROK]: 0.8, // Grok은 상대적으로 저렴
      [AIModel.CUSTOM]: 2.0, // 커스텀 모델은 프리미엄
      default: 1.0,
    };

    // 기본 비용 계산
    const baseCostPerK = MODEL_COSTS[aiModel] || MODEL_COSTS.default;
    const baseCost = (apiTokensUsed / 1000) * baseCostPerK;

    // 응답 길이에 따른 추가 비용 (긴 응답은 더 많은 비용)
    let lengthMultiplier = 1.0;
    if (responseLength > 2000) {
      lengthMultiplier = 1.5; // 2000자 초과 시 1.5배
    } else if (responseLength > 1000) {
      lengthMultiplier = 1.2; // 1000자 초과 시 1.2배
    }

    // 최소 비용 보장 (최소 0.5 토큰)
    const totalCost = Math.max(0.5, baseCost * lengthMultiplier);

    // 소수점 첫째 자리까지 반올림
    return Math.round(totalCost * 10) / 10;
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

    // ContextBuilder를 사용하여 고도화된 컨텍스트 구성
    const llmContext = await this.contextBuilderService.buildContext({
      chatId,
      characterId: chat.character.toString(),
      presetId: chat.presetId?.toString(),
      userId,
      userMessage: content,
    });

    // AI 응답 생성 (고도화된 시스템 프롬프트 사용)
    const aiResponse = await this.aiService.generateResponseWithContext(
      chat.aiModel,
      llmContext.systemPrompt,
      llmContext.messages,
    );

    // AI 응답 콘텐츠 필터링
    const aiResponseCheck = await this.contentFilterService.checkAIResponse(
      aiResponse.content,
      user.isAdultVerified,
    );
    if (aiResponseCheck.isInappropriate) {
      throw new BadRequestException('AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.');
    }

    // 추천 응답 파싱 (스토리 모드에서만)
    let finalContent = aiResponse.content;
    let suggestedReplies: string[] = [];

    if (llmContext.includeSuggestions) {
      const parsed = this.contextBuilderService.parseResponseWithSuggestions(aiResponse.content);
      finalContent = parsed.reply;
      suggestedReplies = parsed.suggestions;
    }

    // AI 메시지 추가
    chat.messages.push({
      sender: 'ai',
      content: finalContent,
      timestamp: new Date(),
      tokensUsed: aiResponse.tokensUsed,
      suggestedReplies: suggestedReplies.length > 0 ? suggestedReplies : undefined,
    });

    // 토큰 사용량 업데이트
    chat.totalTokensUsed += aiResponse.tokensUsed;
    chat.lastActivity = new Date();

    // 토큰 차감 (AI 모델 및 응답 길이에 따라 가변 비용 적용)
    const tokenCost = this.calculateTokenCost(chat.aiModel, aiResponse.tokensUsed, finalContent.length);

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
    const savedChat = await chat.save();

    // 메모리 요약 체크 (비동기)
    this.checkAndTriggerMemorySummary(savedChat).catch(err => {
      console.error('Failed to check memory summary:', err);
    });

    return savedChat;
  }

  async changeAIModel(chatId: string, userId: string, aiModel: AIModel): Promise<Chat> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 AI 모델을 변경할 권한이 없습니다.');
    }

    chat.aiModel = aiModel;
    return chat.save();
  }

  async changeMode(chatId: string, userId: string, mode: ChatMode): Promise<Chat> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 모드를 변경할 권한이 없습니다.');
    }

    chat.mode = mode;
    return chat.save();
  }

  async getSessionState(chatId: string, userId: string): Promise<EmbeddedSessionState> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 세션 상태를 조회할 권한이 없습니다.');
    }

    return chat.sessionState || {
      mood: '평온',
      relationshipLevel: 0,
      scene: '',
      progressCounter: 1,
      lastSceneSummary: '',
    };
  }

  async updateSessionState(
    chatId: string,
    userId: string,
    stateDto: UpdateSessionStateDto,
  ): Promise<EmbeddedSessionState> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 세션 상태를 수정할 권한이 없습니다.');
    }

    // 부분 업데이트
    if (!chat.sessionState) {
      chat.sessionState = {
        mood: '평온',
        relationshipLevel: 0,
        scene: '',
        progressCounter: 1,
        lastSceneSummary: '',
      };
    }

    if (stateDto.mood !== undefined) chat.sessionState.mood = stateDto.mood;
    if (stateDto.relationshipLevel !== undefined) chat.sessionState.relationshipLevel = stateDto.relationshipLevel;
    if (stateDto.scene !== undefined) chat.sessionState.scene = stateDto.scene;
    if (stateDto.progressCounter !== undefined) chat.sessionState.progressCounter = stateDto.progressCounter;
    if (stateDto.lastSceneSummary !== undefined) chat.sessionState.lastSceneSummary = stateDto.lastSceneSummary;

    await chat.save();
    return chat.sessionState;
  }

  /**
   * 메모리 요약 필요 여부 체크 및 트리거
   * 20개 메시지마다 자동으로 요약 생성
   */
  async checkAndTriggerMemorySummary(chat: Chat): Promise<void> {
    const messageCount = chat.messages.length;
    const summaryCount = chat.memorySummaryCount || 0;
    const expectedSummaries = Math.floor(messageCount / MEMORY_SUMMARY_TRIGGER_COUNT);

    if (expectedSummaries > summaryCount) {
      // 요약이 필요한 메시지 범위 계산
      const startIndex = summaryCount * MEMORY_SUMMARY_TRIGGER_COUNT;
      const endIndex = expectedSummaries * MEMORY_SUMMARY_TRIGGER_COUNT;
      const messagesToSummarize = chat.messages.slice(startIndex, endIndex);

      // 비동기로 요약 생성 (응답 지연 방지)
      this.createMemorySummary(chat, startIndex, endIndex, messagesToSummarize).catch(err => {
        console.error('Failed to create memory summary:', err);
      });
    }
  }

  /**
   * 메모리 요약 생성
   */
  private async createMemorySummary(
    chat: Chat,
    startIndex: number,
    endIndex: number,
    messages: any[],
  ): Promise<void> {
    // 메시지 내용 추출
    const conversationText = messages
      .map(msg => `${msg.sender === 'user' ? '유저' : '캐릭터'}: ${msg.content}`)
      .join('\n');

    // AI를 사용한 요약 생성 (간단한 프롬프트)
    const summaryPrompt = `다음 대화 내용을 3-5문장으로 요약해주세요. 핵심 이벤트, 감정 변화, 중요 정보를 포함해주세요:\n\n${conversationText}`;

    try {
      // 캐릭터 정보 가져오기
      const character = await this.charactersService.findById(chat.character.toString());

      // 요약 생성 (기존 AI 서비스 활용)
      const summaryResponse = await this.aiService.generateResponse(
        chat.aiModel,
        character,
        [],
        summaryPrompt,
      );

      // 키 이벤트 및 감정 톤 추출 (간단한 처리)
      const keyEvents = [summaryResponse.content.split('.')[0]?.trim() || '대화 진행'];
      const emotionalTone = '중립'; // 추후 AI 분석으로 개선 가능

      // 요약 저장
      const memorySummary = new this.memorySummaryModel({
        sessionId: new Types.ObjectId(String(chat._id)),
        characterId: chat.character,
        userId: chat.user,
        messageRange: { startIndex, endIndex },
        summaryText: summaryResponse.content,
        keyEvents,
        emotionalTone,
      });

      await memorySummary.save();

      // 요약 카운트 증가
      chat.memorySummaryCount = Math.floor(endIndex / MEMORY_SUMMARY_TRIGGER_COUNT);
      await chat.save();

      this.logger.log(`Memory summary created for chat ${chat._id}, messages ${startIndex}-${endIndex}`);
    } catch (error) {
      this.logger.error('Error creating memory summary:', error);
    }
  }

  async delete(chatId: string, userId: string): Promise<void> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅을 삭제할 권한이 없습니다.');
    }

    await this.chatModel.findByIdAndDelete(chatId).exec();
  }

  /**
   * 디버그 정보 조회 (크리에이터용)
   * 현재 컨텍스트, 시스템 프롬프트, 메모리 요약 등 확인
   */
  async getDebugInfo(chatId: string, userId: string): Promise<any> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 디버그 정보를 조회할 권한이 없습니다.');
    }

    // 캐릭터 소유자 확인
    const character = await this.charactersService.findById(chat.character.toString());
    const isCreator = character.creator?.toString() === userId;

    // 컨텍스트 빌드 (테스트 메시지로)
    const llmContext = await this.contextBuilderService.buildContext({
      chatId,
      characterId: chat.character.toString(),
      presetId: chat.presetId?.toString(),
      userId,
      userMessage: '[DEBUG_TEST]',
    });

    // 메모리 요약 목록
    const memorySummaries = await this.memorySummaryModel
      .find({ sessionId: chat._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    return {
      chatInfo: {
        id: chat._id,
        mode: chat.mode,
        aiModel: chat.aiModel,
        messageCount: chat.messages.length,
        totalTokensUsed: chat.totalTokensUsed,
        memorySummaryCount: chat.memorySummaryCount || 0,
        presetId: chat.presetId?.toString() || null,
      },
      sessionState: chat.sessionState,
      characterInfo: {
        id: character._id,
        name: character.name,
        worldId: character.worldId?.toString() || null,
        isCreator,
      },
      context: {
        systemPromptLength: llmContext.systemPrompt.length,
        systemPromptPreview: llmContext.systemPrompt.substring(0, 500) + '...',
        fullSystemPrompt: isCreator ? llmContext.systemPrompt : undefined,
        messagesCount: llmContext.messages.length,
        includeSuggestions: llmContext.includeSuggestions,
      },
      memorySummaries: memorySummaries.map((s) => ({
        id: s._id,
        messageRange: s.messageRange,
        summaryText: s.summaryText,
        keyEvents: s.keyEvents,
        emotionalTone: s.emotionalTone,
        createdAt: s.createdAt,
      })),
    };
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

          // ContextBuilder를 사용하여 고도화된 컨텍스트 구성
          const llmContext = await this.contextBuilderService.buildContext({
            chatId,
            characterId: chat.character.toString(),
            presetId: chat.presetId?.toString(),
            userId,
            userMessage: content,
          });

          // 전체 응답 내용을 누적하기 위한 변수
          let fullResponse = '';

          // AI 스트리밍 응답 생성 (고도화된 시스템 프롬프트 사용)
          const { totalTokensUsed } = await this.aiService.generateStreamingResponseWithContext(
            chat.aiModel,
            llmContext.systemPrompt,
            llmContext.messages,
            (chunk: string) => {
              // 각 청크를 클라이언트로 전송
              fullResponse += chunk;
              observer.next({
                data: JSON.stringify({
                  type: 'chunk',
                  content: chunk,
                }),
              } as MessageEvent);
            },
          );

          // AI 응답 콘텐츠 필터링
          const aiResponseCheck = await this.contentFilterService.checkAIResponse(
            fullResponse,
            user.isAdultVerified,
          );
          if (aiResponseCheck.isInappropriate) {
            observer.error(new BadRequestException('AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.'));
            return;
          }

          // 추천 응답 파싱 (스토리 모드에서만)
          let finalContent = fullResponse;
          let suggestedReplies: string[] = [];

          if (llmContext.includeSuggestions) {
            const parsed = this.contextBuilderService.parseResponseWithSuggestions(fullResponse);
            finalContent = parsed.reply;
            suggestedReplies = parsed.suggestions;
          }

          // AI 메시지 추가
          chat.messages.push({
            sender: 'ai',
            content: finalContent,
            timestamp: new Date(),
            tokensUsed: totalTokensUsed,
            suggestedReplies: suggestedReplies.length > 0 ? suggestedReplies : undefined,
          });

          // 토큰 사용량 업데이트
          chat.totalTokensUsed += totalTokensUsed;
          chat.lastActivity = new Date();

          // 토큰 차감 (AI 모델 및 응답 길이에 따라 가변 비용 적용)
          const tokenCost = this.calculateTokenCost(chat.aiModel, totalTokensUsed, finalContent.length);

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
          const savedChat = await chat.save();

          // 메모리 요약 체크 (비동기)
          this.checkAndTriggerMemorySummary(savedChat).catch(err => {
            console.error('Failed to check memory summary:', err);
          });

          // 스트리밍 완료 신호 전송 (추천 응답 포함)
          observer.next({
            data: JSON.stringify({
              type: 'done',
              tokensUsed: totalTokensUsed,
              tokenCost,
              suggestedReplies: suggestedReplies.length > 0 ? suggestedReplies : undefined,
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