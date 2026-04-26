import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  MessageEvent,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatMode, EmbeddedSessionState } from './schemas/chat.schema';
import { AIService } from './ai.service';
import { CharactersService } from '../characters/characters.service';
import { UsersService } from '../users/users.service';
import { ContentFilterService } from './content-filter.service';
import {
  ContextBuilderService,
  ResponseStatePatch,
} from './services/context-builder.service';
import { AIModel } from '../characters/schemas/character.schema';
import {
  MemorySummary,
  MemoryType,
} from '../memory/schemas/memory-summary.schema';
import { Observable } from 'rxjs';
import { UpdateSessionStateDto } from './dto/update-session-state.dto';
import {
  PersonaPreset,
  PresetMood,
} from '../persona-presets/schemas/persona-preset.schema';

export interface CreateChatOptions {
  aiModel?: AIModel;
  presetId?: string;
  mode?: ChatMode;
  title?: string;
}

// 메모리 요약 트리거 기준 메시지 수
const MEMORY_SUMMARY_TRIGGER_COUNT = 20;
const STREAM_METADATA_HOLDBACK = 160;

interface EventMemoryDraft {
  messageRange: { start: number; end: number };
  summaryText: string;
  eventCategory: string;
  keyEvents: string[];
  emotionalTone?: string;
  importantFacts: string[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(MemorySummary.name)
    private memorySummaryModel: Model<MemorySummary>,
    @InjectModel(PersonaPreset.name)
    private presetModel: Model<PersonaPreset>,
    private aiService: AIService,
    private charactersService: CharactersService,
    private usersService: UsersService,
    private contentFilterService: ContentFilterService,
    private contextBuilderService: ContextBuilderService,
  ) {}

  async create(
    userId: string,
    characterId: string,
    options?: CreateChatOptions,
  ): Promise<Chat> {
    // 캐릭터 존재 확인
    const character = await this.charactersService.findById(characterId);

    // 성인 컨텐츠 캐릭터와 대화 시 성인 인증 확인
    if (character.isAdultContent) {
      const user = await this.usersService.findById(userId);
      if (!user.isAdultVerified) {
        throw new ForbiddenException(
          '성인 컨텐츠 캐릭터와 대화하려면 성인 인증이 필요합니다.',
        );
      }
    }

    const preset = options?.presetId
      ? await this.presetModel.findById(options.presetId).exec()
      : null;

    if (preset && preset.characterId.toString() !== characterId) {
      throw new BadRequestException(
        '선택한 페르소나 프리셋이 이 캐릭터에 속하지 않습니다.',
      );
    }

    const initialAssistantMessage = this.buildInitialAssistantMessage(
      character,
      preset,
    );

    // 새 채팅 생성
    const newChat = new this.chatModel({
      user: userId,
      character: characterId,
      aiModel: options?.aiModel || character.defaultAIModel,
      messages: initialAssistantMessage
        ? [
            {
              sender: 'ai',
              content: initialAssistantMessage,
              timestamp: new Date(),
            },
          ]
        : [],
      presetId: options?.presetId
        ? new Types.ObjectId(options.presetId)
        : undefined,
      mode: options?.mode || ChatMode.CHAT,
      title: options?.title,
      sessionState: this.buildInitialSessionState(character, preset),
      lastActivity: new Date(),
    });

    return newChat.save();
  }

  async findById(id: string, userId?: string): Promise<Chat> {
    const chat = await this.chatModel.findById(id).exec();
    if (!chat) {
      throw new NotFoundException(`채팅 ID ${id}를 찾을 수 없습니다.`);
    }
    if (userId && chat.user.toString() !== userId) {
      throw new ForbiddenException('이 채팅을 조회할 권한이 없습니다.');
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

  private buildInitialSessionState(
    character: any,
    preset?: PersonaPreset | null,
  ): EmbeddedSessionState {
    return {
      mood: this.mapPresetMoodToStateMood(preset?.mood) || '평온',
      relationshipLevel: this.estimateInitialRelationshipLevel(
        preset?.relationshipToUser,
      ),
      scene: this.deriveSceneLabel(preset?.scenarioIntro || character.scenario),
      progressCounter: 1,
      lastSceneSummary: this.buildSeedSceneSummary(character, preset),
      activeFlags: [],
      currentObjective: this.buildInitialObjective(character, preset),
    };
  }

  private buildInitialAssistantMessage(
    character: any,
    preset?: PersonaPreset | null,
  ): string | null {
    const sections: string[] = [];

    if (preset?.scenarioIntro?.trim()) {
      sections.push(this.toNarration(preset.scenarioIntro));
    } else if (character.scenario?.trim()) {
      sections.push(this.toNarration(character.scenario));
    }

    if (character.greeting?.trim()) {
      sections.push(character.greeting.trim());
    }

    if (sections.length === 0) {
      return null;
    }

    return sections.join('\n\n');
  }

  private toNarration(text: string): string {
    const trimmed = text.trim();

    if (!trimmed) {
      return '';
    }

    if (trimmed.includes('*')) {
      return trimmed;
    }

    return `*${trimmed}*`;
  }

  private buildSeedSceneSummary(
    character: any,
    preset?: PersonaPreset | null,
  ): string {
    const summarySource = preset?.scenarioIntro || character.scenario || '';
    return summarySource.trim().slice(0, 240);
  }

  private buildInitialObjective(
    character: any,
    preset?: PersonaPreset | null,
  ): string {
    if (preset?.scenarioIntro?.trim()) {
      return this.truncateStateText(
        `${preset.title} 상황에서 자연스럽게 첫 대화를 이어간다.`,
        120,
      ) || '상황에 맞춰 자연스럽게 첫 대화를 이어간다.';
    }

    if (character.scenario?.trim()) {
      return (
        this.truncateStateText('현재 장면에 어울리게 대화를 시작한다.', 120) ||
        '현재 장면에 어울리게 대화를 시작한다.'
      );
    }

    return '상대와 자연스럽게 첫 대화를 이어간다.';
  }

  private mapPresetMoodToStateMood(presetMood?: PresetMood): string | null {
    if (!presetMood) {
      return null;
    }

    const presetMoodMap: Record<PresetMood, string> = {
      [PresetMood.COMIC]: '유쾌',
      [PresetMood.CALM]: '평온',
      [PresetMood.SERIOUS]: '진지',
      [PresetMood.DARK]: '긴장',
      [PresetMood.ROMANTIC]: '설렘',
      [PresetMood.TENSE]: '긴장',
    };

    return presetMoodMap[presetMood] || null;
  }

  private estimateInitialRelationshipLevel(relationshipToUser?: string): number {
    const relation = relationshipToUser?.toLowerCase() || '';

    if (
      relation.includes('연인') ||
      relation.includes('lover') ||
      relation.includes('spouse')
    ) {
      return 3;
    }

    if (
      relation.includes('friend') ||
      relation.includes('친구') ||
      relation.includes('동료') ||
      relation.includes('partner')
    ) {
      return 1;
    }

    return 0;
  }

  private deriveSceneLabel(source?: string): string {
    if (!source?.trim()) {
      return '';
    }

    const trimmed = source.trim();
    const directMatch = trimmed.match(
      /(학교 옥상|신사 입구|연습실|도서관|카페|공원|바닷가|해변|거리|골목|교실|지하철|주방|거실|침실|사무실|옥상|정원|광장|시장|호텔|병원|기숙사|서재|성당|궁전|던전|성문)/,
    );
    if (directMatch) {
      return directMatch[1];
    }

    return trimmed
      .replace(/[*"]/g, '')
      .split(/[.\n]/)[0]
      .slice(0, 32);
  }

  private deriveNextSessionState(params: {
    chat: Chat;
    userMessage: string;
    assistantMessage: string;
    character: any;
    preset?: PersonaPreset | null;
    llmStatePatch?: ResponseStatePatch;
  }): EmbeddedSessionState {
    const {
      chat,
      userMessage,
      assistantMessage,
      character,
      preset,
      llmStatePatch,
    } = params;
    const currentState =
      chat.sessionState || this.buildInitialSessionState(character, preset);
    const combinedText = `${userMessage}\n${assistantMessage}`;
    const assistantMessageCount = chat.messages.filter(
      (message) => message.sender === 'ai',
    ).length;
    const progressCounter = ((Math.max(assistantMessageCount, 1) - 1) % 5) + 1;
    const relationshipLevel = this.deriveRelationshipLevel({
      currentLevel: currentState.relationshipLevel,
      assistantMessageCount,
      combinedText,
      preset,
      llmStatePatch,
    });
    const scene =
      this.truncateStateText(llmStatePatch?.scene, 40) ||
      this.deriveSceneLabel(combinedText) ||
      currentState.scene ||
      this.deriveSceneLabel(preset?.scenarioIntro || character.scenario);
    const mood = this.deriveMoodLabel(
      combinedText,
      currentState.mood,
      relationshipLevel,
      llmStatePatch?.mood,
    );
    const activeFlags = this.mergeActiveFlags(
      currentState.activeFlags,
      llmStatePatch?.activeFlags,
    );
    const currentObjective =
      this.truncateStateText(llmStatePatch?.currentObjective, 120) ||
      currentState.currentObjective ||
      this.buildInitialObjective(character, preset);
    const llmSceneSummary = this.truncateStateText(
      llmStatePatch?.lastSceneSummary,
      320,
    );

    return {
      mood,
      relationshipLevel,
      scene,
      progressCounter,
      lastSceneSummary:
        llmSceneSummary ||
        (progressCounter === 5
          ? this.buildRecentSceneSummary(chat.messages)
          : currentState.lastSceneSummary),
      activeFlags,
      currentObjective,
    };
  }

  private deriveRelationshipLevel(params: {
    currentLevel: number;
    assistantMessageCount: number;
    combinedText: string;
    preset?: PersonaPreset | null;
    llmStatePatch?: ResponseStatePatch;
  }): number {
    const {
      currentLevel,
      assistantMessageCount,
      combinedText,
      preset,
      llmStatePatch,
    } = params;
    const normalized = combinedText.toLowerCase();
    const closeKeywords = [
      '좋아',
      '사랑',
      '설레',
      '보고 싶',
      '안아',
      '곁에',
      '손을',
      '믿어',
      '함께',
      'kiss',
      'love',
    ];

    const closeScore = closeKeywords.reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    );

    let nextLevel = Math.max(
      currentLevel,
      this.estimateInitialRelationshipLevel(preset?.relationshipToUser),
      Math.min(5, Math.floor(Math.max(assistantMessageCount - 1, 0) / 4)),
    );

    if (closeScore >= 2) {
      nextLevel = Math.min(5, nextLevel + 1);
    }

    if (typeof llmStatePatch?.relationshipLevel === 'number') {
      nextLevel = this.clampRelationshipLevel(llmStatePatch.relationshipLevel);
    }

    return nextLevel;
  }

  private deriveMoodLabel(
    combinedText: string,
    currentMood: string,
    relationshipLevel: number,
    llmMood?: string,
  ): string {
    const normalizedLlmMood = this.truncateStateText(llmMood, 24);
    if (normalizedLlmMood) {
      return normalizedLlmMood;
    }

    const normalized = combinedText.toLowerCase();
    const romanticKeywords = [
      '좋아',
      '사랑',
      '설레',
      '두근',
      '안아',
      '입술',
      'kiss',
      'love',
    ];
    const tenseKeywords = [
      '긴장',
      '위험',
      '조심',
      '비밀',
      '떨려',
      '숨',
      '망설',
    ];
    const conflictKeywords = ['싫어', '화나', '갈등', '미워', '위협', '다투'];
    const calmKeywords = ['괜찮', '안심', '편안', '잔잔', '고요'];

    const romanticScore = romanticKeywords.reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    const tenseScore = tenseKeywords.reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    const conflictScore = conflictKeywords.reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    const calmScore = calmKeywords.reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    );

    if (conflictScore > 0) {
      return '갈등';
    }

    if (romanticScore >= 2 && relationshipLevel >= 3) {
      return '친밀';
    }

    if (romanticScore > 0) {
      return '설렘';
    }

    if (tenseScore > 0) {
      return '긴장';
    }

    if (calmScore > 0) {
      return '평온';
    }

    return currentMood || '평온';
  }

  private clampRelationshipLevel(level: number): number {
    return Math.max(0, Math.min(5, Math.round(level)));
  }

  private truncateStateText(
    value: string | undefined,
    maxLength: number,
  ): string | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private mergeActiveFlags(
    currentFlags: string[] | undefined,
    incomingFlags: string[] | undefined,
  ): string[] {
    const merged = [...(currentFlags || []), ...(incomingFlags || [])]
      .map((flag) => flag.trim())
      .filter(Boolean);

    return Array.from(new Set(merged)).slice(-5);
  }

  private buildRecentSceneSummary(
    messages: Array<{ sender: string; content: string }>,
  ): string {
    const recentMessages = messages
      .slice(-6)
      .map((message) => {
        const speaker = message.sender === 'user' ? '유저' : '캐릭터';
        const normalizedContent = message.content
          .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        return normalizedContent ? `${speaker}: ${normalizedContent}` : '';
      })
      .filter(Boolean);

    return recentMessages.join(' / ').slice(0, 320);
  }

  private cloneSessionState(
    state: EmbeddedSessionState | undefined,
    character: any,
    preset?: PersonaPreset | null,
  ): EmbeddedSessionState {
    const baseState = state || this.buildInitialSessionState(character, preset);

    return {
      ...baseState,
      activeFlags: [...(baseState.activeFlags || [])],
    };
  }

  private normalizeStateValue(value?: string): string {
    return value?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
  }

  private buildEventMemoryDraft(params: {
    chat: Chat;
    previousState: EmbeddedSessionState;
    nextState: EmbeddedSessionState;
  }): EventMemoryDraft | null {
    const { chat, previousState, nextState } = params;
    const previousFlags = new Set(previousState.activeFlags || []);
    const addedFlags = (nextState.activeFlags || []).filter(
      (flag) => !previousFlags.has(flag),
    );
    const relationshipDelta =
      nextState.relationshipLevel - previousState.relationshipLevel;
    const sceneChanged =
      !!nextState.scene &&
      this.normalizeStateValue(previousState.scene) !==
        this.normalizeStateValue(nextState.scene);
    const summaryChanged =
      !!nextState.lastSceneSummary &&
      this.normalizeStateValue(previousState.lastSceneSummary) !==
        this.normalizeStateValue(nextState.lastSceneSummary);
    const objectiveChanged =
      !!nextState.currentObjective &&
      this.normalizeStateValue(previousState.currentObjective) !==
        this.normalizeStateValue(nextState.currentObjective);
    const hasMeaningfulSceneChange = sceneChanged && summaryChanged;

    if (
      addedFlags.length === 0 &&
      relationshipDelta === 0 &&
      !hasMeaningfulSceneChange
    ) {
      return null;
    }

    const keyEvents: string[] = [];
    if (addedFlags.length > 0) {
      keyEvents.push(...addedFlags.map((flag) => `플래그 획득: ${flag}`));
    }

    if (relationshipDelta > 0) {
      keyEvents.push(
        `관계 진전: Lv.${previousState.relationshipLevel} -> Lv.${nextState.relationshipLevel}`,
      );
    } else if (relationshipDelta < 0) {
      keyEvents.push(
        `관계 변화: Lv.${previousState.relationshipLevel} -> Lv.${nextState.relationshipLevel}`,
      );
    }

    if (hasMeaningfulSceneChange) {
      keyEvents.push(`장면 전환: ${nextState.scene}`);
    }

    if (objectiveChanged) {
      keyEvents.push(`현재 목표 갱신: ${nextState.currentObjective}`);
    }

    const importantFacts = [
      summaryChanged ? nextState.lastSceneSummary : undefined,
      objectiveChanged && nextState.currentObjective
        ? `현재 목표: ${nextState.currentObjective}`
        : undefined,
      nextState.scene ? `현재 장면: ${nextState.scene}` : undefined,
      addedFlags.length > 0
        ? `활성 플래그: ${addedFlags.slice(0, 3).join(', ')}`
        : undefined,
      relationshipDelta !== 0
        ? `관계 레벨: ${previousState.relationshipLevel} -> ${nextState.relationshipLevel}`
        : undefined,
    ].filter((fact): fact is string => Boolean(fact));

    const summaryText =
      this.truncateStateText(
        summaryChanged
          ? nextState.lastSceneSummary
          : this.buildEventSummaryText({
              addedFlags,
              relationshipDelta,
              previousState,
              nextState,
              objectiveChanged,
              hasMeaningfulSceneChange,
            }),
        320,
      ) || '대화 흐름에 의미 있는 변화가 생겼다.';

    return {
      messageRange: {
        start: Math.max(chat.messages.length - 2, 0),
        end: chat.messages.length,
      },
      summaryText,
      eventCategory:
        addedFlags.length > 0
          ? 'flag'
          : relationshipDelta !== 0
            ? 'relationship'
            : 'scene',
      keyEvents: keyEvents.slice(0, 4),
      emotionalTone: nextState.mood,
      importantFacts: Array.from(new Set(importantFacts)).slice(0, 4),
    };
  }

  private buildEventSummaryText(params: {
    addedFlags: string[];
    relationshipDelta: number;
    previousState: EmbeddedSessionState;
    nextState: EmbeddedSessionState;
    objectiveChanged: boolean;
    hasMeaningfulSceneChange: boolean;
  }): string {
    const {
      addedFlags,
      relationshipDelta,
      previousState,
      nextState,
      objectiveChanged,
      hasMeaningfulSceneChange,
    } = params;
    const fragments: string[] = [];

    if (addedFlags.length > 0) {
      fragments.push(`${addedFlags.join(', ')} 변화가 새롭게 확정됐다.`);
    }

    if (relationshipDelta > 0) {
      fragments.push(
        `유저와의 관계가 Lv.${previousState.relationshipLevel}에서 Lv.${nextState.relationshipLevel}(으)로 가까워졌다.`,
      );
    } else if (relationshipDelta < 0) {
      fragments.push(
        `유저와의 관계가 Lv.${previousState.relationshipLevel}에서 Lv.${nextState.relationshipLevel}(으)로 낮아졌다.`,
      );
    }

    if (hasMeaningfulSceneChange) {
      fragments.push(`대화 장면이 ${nextState.scene}(으)로 전환됐다.`);
    }

    if (objectiveChanged && nextState.currentObjective) {
      fragments.push(`다음 흐름의 목표는 ${nextState.currentObjective}이다.`);
    }

    return fragments.join(' ');
  }

  private buildMemoryDraftSignature(draft: EventMemoryDraft): string {
    return [
      draft.summaryText,
      draft.eventCategory,
      draft.keyEvents.join('|'),
      draft.importantFacts.join('|'),
    ].join('::');
  }

  private async persistEventMemory(
    chat: Chat,
    draft: EventMemoryDraft,
  ): Promise<void> {
    const latestEventMemory = await this.memorySummaryModel
      .findOne({
        sessionId: new Types.ObjectId(String(chat._id)),
        memoryType: MemoryType.EVENT,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (latestEventMemory) {
      const latestSignature = this.buildMemoryDraftSignature({
        messageRange: latestEventMemory.messageRange,
        summaryText: latestEventMemory.summaryText,
        eventCategory: latestEventMemory.eventCategory || 'event',
        keyEvents: latestEventMemory.keyEvents || [],
        emotionalTone: latestEventMemory.emotionalTone,
        importantFacts: latestEventMemory.importantFacts || [],
      });

      if (latestSignature === this.buildMemoryDraftSignature(draft)) {
        return;
      }
    }

    const eventMemory = new this.memorySummaryModel({
      sessionId: new Types.ObjectId(String(chat._id)),
      messageRange: draft.messageRange,
      summaryText: draft.summaryText,
      memoryType: MemoryType.EVENT,
      eventCategory: draft.eventCategory,
      keyEvents: draft.keyEvents,
      emotionalTone: draft.emotionalTone,
      importantFacts: draft.importantFacts,
    });

    await eventMemory.save();

    this.logger.log(
      `Event memory created for chat ${chat._id}, messages ${draft.messageRange.start}-${draft.messageRange.end}`,
    );
  }

  private async processDerivedMemories(
    chat: Chat,
    eventMemoryDraft: EventMemoryDraft | null,
  ): Promise<void> {
    if (eventMemoryDraft) {
      await this.persistEventMemory(chat, eventMemoryDraft);
    }

    await this.checkAndTriggerMemorySummary(chat);
  }

  private extractImportantFactsFromMessages(
    messages: Array<{ sender: string; content: string }>,
    sessionState?: EmbeddedSessionState,
  ): string[] {
    const keywords = [
      '약속',
      '비밀',
      '별명',
      '이름',
      '좋아',
      '싫어',
      '내일',
      '다음에',
      '취미',
      '가족',
      '생일',
    ];
    const facts: string[] = [];

    messages.slice(-8).forEach((message) => {
      const speaker = message.sender === 'user' ? '유저' : '캐릭터';
      const normalizedContent = message.content
        .replace(/\[STATE\][\s\S]*?\[\/STATE\]/g, '')
        .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/g, '')
        .replace(/[*"]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalizedContent) {
        return;
      }

      normalizedContent
        .split(/[.!?\n]/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 8 && line.length <= 90)
        .forEach((line) => {
          if (keywords.some((keyword) => line.includes(keyword))) {
            facts.push(`${speaker}: ${line}`);
          }
        });
    });

    if (sessionState?.currentObjective?.trim()) {
      facts.push(`현재 목표: ${sessionState.currentObjective.trim()}`);
    }

    if (sessionState?.activeFlags?.length) {
      facts.push(`활성 플래그: ${sessionState.activeFlags.slice(-3).join(', ')}`);
    }

    return Array.from(
      new Set(
        facts
          .map((fact) => fact.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      ),
    ).slice(0, 6);
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
    const character = await this.charactersService.findById(
      chat.character.toString(),
    );
    const preset = chat.presetId
      ? await this.presetModel.findById(chat.presetId).exec()
      : null;
    const previousSessionState = this.cloneSessionState(
      chat.sessionState,
      character,
      preset,
    );

    // 토큰 부족 확인 (구독자도 토큰 필요)
    if (user.tokens <= 0) {
      throw new BadRequestException('토큰이 부족합니다. 토큰을 충전해주세요.');
    }

    // 콘텐츠 필터링 (OpenAI Moderation API + 키워드 필터)
    const contentCheck = await this.contentFilterService.checkContent(
      content,
      user.isAdultVerified,
    );
    if (contentCheck.isInappropriate) {
      throw new BadRequestException(
        contentCheck.reason || '부적절한 내용이 포함되어 있습니다.',
      );
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
      character.temperature ?? 0.7,
    );

    // AI 응답 콘텐츠 필터링
    const aiResponseCheck = await this.contentFilterService.checkAIResponse(
      aiResponse.content,
      user.isAdultVerified,
    );
    if (aiResponseCheck.isInappropriate) {
      throw new BadRequestException(
        'AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.',
      );
    }

    const parsedResponse =
      this.contextBuilderService.parseStructuredResponse(aiResponse.content);
    const finalContent = parsedResponse.reply;
    const suggestedReplies = llmContext.includeSuggestions
      ? parsedResponse.suggestions
      : [];

    // AI 메시지 추가
    chat.messages.push({
      sender: 'ai',
      content: finalContent,
      timestamp: new Date(),
      tokensUsed: aiResponse.tokensUsed,
      suggestedReplies:
        suggestedReplies.length > 0 ? suggestedReplies : undefined,
    });

    chat.sessionState = this.deriveNextSessionState({
      chat,
      userMessage: content,
      assistantMessage: finalContent,
      character,
      preset,
      llmStatePatch: parsedResponse.statePatch,
    });
    const eventMemoryDraft = this.buildEventMemoryDraft({
      chat,
      previousState: previousSessionState,
      nextState: chat.sessionState,
    });

    // 토큰 사용량 업데이트
    chat.totalTokensUsed += aiResponse.tokensUsed;
    chat.lastActivity = new Date();

    // 토큰 차감 (AI 모델 및 응답 길이에 따라 가변 비용 적용)
    const tokenCost = this.calculateTokenCost(
      chat.aiModel,
      aiResponse.tokensUsed,
      finalContent.length,
    );

    // 모든 사용자 토큰 차감 (구독자 무제한 대화 제거)
    await this.usersService.useTokens(userId, tokenCost);

    // 캐릭터 사용 횟수 증가
    await this.charactersService.incrementUsageCount(chat.character.toString());

    // 크리에이터 수익 기록 (구독자도 포함 - 수익은 배분됨)
    await this.charactersService.recordCreatorEarning(
      chat.character.toString(),
      tokenCost,
    );

    // 사용자 대화 횟수 증가 및 레벨 업데이트
    const updatedUser = await this.usersService.findById(userId);
    updatedUser.totalConversations += 1;
    await updatedUser.save();

    if (
      updatedUser.totalConversations === 1000 ||
      updatedUser.totalConversations === 10000
    ) {
      await this.usersService.updateCreatorLevel(userId);
    }

    // 채팅 저장
    const savedChat = await chat.save();

    // 사건 기억/메모리 요약 체크 (비동기)
    this.processDerivedMemories(savedChat, eventMemoryDraft).catch((err) => {
      console.error('Failed to process derived memories:', err);
    });

    return savedChat;
  }

  async changeAIModel(
    chatId: string,
    userId: string,
    aiModel: AIModel,
  ): Promise<Chat> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException(
        '이 채팅의 AI 모델을 변경할 권한이 없습니다.',
      );
    }

    chat.aiModel = aiModel;
    return chat.save();
  }

  async changeMode(
    chatId: string,
    userId: string,
    mode: ChatMode,
  ): Promise<Chat> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException('이 채팅의 모드를 변경할 권한이 없습니다.');
    }

    chat.mode = mode;
    return chat.save();
  }

  async getSessionState(
    chatId: string,
    userId: string,
  ): Promise<EmbeddedSessionState> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException(
        '이 채팅의 세션 상태를 조회할 권한이 없습니다.',
      );
    }

    return (
      chat.sessionState || {
        mood: '평온',
        relationshipLevel: 0,
        scene: '',
        progressCounter: 1,
        lastSceneSummary: '',
        activeFlags: [],
        currentObjective: '',
      }
    );
  }

  async updateSessionState(
    chatId: string,
    userId: string,
    stateDto: UpdateSessionStateDto,
  ): Promise<EmbeddedSessionState> {
    const chat = await this.findById(chatId);

    if (chat.user.toString() !== userId) {
      throw new BadRequestException(
        '이 채팅의 세션 상태를 수정할 권한이 없습니다.',
      );
    }

    // 부분 업데이트
    if (!chat.sessionState) {
      chat.sessionState = {
        mood: '평온',
        relationshipLevel: 0,
        scene: '',
        progressCounter: 1,
        lastSceneSummary: '',
        activeFlags: [],
        currentObjective: '',
      };
    }

    if (stateDto.mood !== undefined) chat.sessionState.mood = stateDto.mood;
    if (stateDto.relationshipLevel !== undefined)
      chat.sessionState.relationshipLevel = stateDto.relationshipLevel;
    if (stateDto.scene !== undefined) chat.sessionState.scene = stateDto.scene;
    if (stateDto.progressCounter !== undefined)
      chat.sessionState.progressCounter = stateDto.progressCounter;
    if (stateDto.lastSceneSummary !== undefined)
      chat.sessionState.lastSceneSummary = stateDto.lastSceneSummary;
    if (stateDto.activeFlags !== undefined)
      chat.sessionState.activeFlags = stateDto.activeFlags;
    if (stateDto.currentObjective !== undefined)
      chat.sessionState.currentObjective = stateDto.currentObjective;

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
    const expectedSummaries = Math.floor(
      messageCount / MEMORY_SUMMARY_TRIGGER_COUNT,
    );

    if (expectedSummaries > summaryCount) {
      // 요약이 필요한 메시지 범위 계산
      const startIndex = summaryCount * MEMORY_SUMMARY_TRIGGER_COUNT;
      const endIndex = expectedSummaries * MEMORY_SUMMARY_TRIGGER_COUNT;
      const messagesToSummarize = chat.messages.slice(startIndex, endIndex);

      // 비동기로 요약 생성 (응답 지연 방지)
      this.createMemorySummary(
        chat,
        startIndex,
        endIndex,
        messagesToSummarize,
      ).catch((err) => {
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
      .map(
        (msg) => `${msg.sender === 'user' ? '유저' : '캐릭터'}: ${msg.content}`,
      )
      .join('\n');

    // AI를 사용한 요약 생성 (간단한 프롬프트)
    const summaryPrompt = `다음 대화 내용을 3-5문장으로 요약해주세요. 핵심 이벤트, 감정 변화, 중요 정보를 포함해주세요:\n\n${conversationText}`;

    try {
      // 캐릭터 정보 가져오기
      const character = await this.charactersService.findById(
        chat.character.toString(),
      );

      // 요약 생성 (기존 AI 서비스 활용)
      const summaryResponse = await this.aiService.generateResponse(
        chat.aiModel,
        character,
        [],
        summaryPrompt,
      );

      // 키 이벤트 및 감정 톤 추출 (간단한 처리)
      const keyEvents = [
        summaryResponse.content.split('.')[0]?.trim() || '대화 진행',
      ];
      const emotionalTone = '중립'; // 추후 AI 분석으로 개선 가능
      const importantFacts = this.extractImportantFactsFromMessages(
        messages,
        chat.sessionState,
      );

      // 요약 저장
      const memorySummary = new this.memorySummaryModel({
        sessionId: new Types.ObjectId(String(chat._id)),
        characterId: chat.character,
        userId: chat.user,
        messageRange: { start: startIndex, end: endIndex },
        summaryText: summaryResponse.content,
        memoryType: MemoryType.SUMMARY,
        keyEvents,
        emotionalTone,
        importantFacts,
      });

      await memorySummary.save();

      // 요약 카운트 증가
      chat.memorySummaryCount = Math.floor(
        endIndex / MEMORY_SUMMARY_TRIGGER_COUNT,
      );
      await chat.save();

      this.logger.log(
        `Memory summary created for chat ${chat._id}, messages ${startIndex}-${endIndex}`,
      );
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
      throw new BadRequestException(
        '이 채팅의 디버그 정보를 조회할 권한이 없습니다.',
      );
    }

    // 캐릭터 소유자 확인
    const character = await this.charactersService.findById(
      chat.character.toString(),
    );
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
            observer.error(
              new BadRequestException(
                '이 채팅에 메시지를 보낼 권한이 없습니다.',
              ),
            );
            return;
          }

          // 사용자 조회 (토큰 확인)
          const user = await this.usersService.findById(userId);
          const character = await this.charactersService.findById(
            chat.character.toString(),
          );
          const preset = chat.presetId
            ? await this.presetModel.findById(chat.presetId).exec()
            : null;
          const previousSessionState = this.cloneSessionState(
            chat.sessionState,
            character,
            preset,
          );

          // 토큰 부족 확인 (구독자도 토큰 필요)
          if (user.tokens <= 0) {
            observer.error(
              new BadRequestException(
                '토큰이 부족합니다. 토큰을 충전해주세요.',
              ),
            );
            return;
          }

          // 콘텐츠 필터링 (OpenAI Moderation API + 키워드 필터)
          const contentCheck = await this.contentFilterService.checkContent(
            content,
            user.isAdultVerified,
          );
          if (contentCheck.isInappropriate) {
            observer.error(
              new BadRequestException(
                contentCheck.reason || '부적절한 내용이 포함되어 있습니다.',
              ),
            );
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
          let emittedLength = 0;

          // AI 스트리밍 응답 생성 (고도화된 시스템 프롬프트 사용)
          const { totalTokensUsed } =
            await this.aiService.generateStreamingResponseWithContext(
              chat.aiModel,
              llmContext.systemPrompt,
              llmContext.messages,
              (chunk: string) => {
                fullResponse += chunk;
                const safeVisibleLength = Math.max(
                  0,
                  fullResponse.length - STREAM_METADATA_HOLDBACK,
                );

                if (safeVisibleLength > emittedLength) {
                  const visibleChunk = fullResponse.slice(
                    emittedLength,
                    safeVisibleLength,
                  );
                  emittedLength = safeVisibleLength;

                  if (visibleChunk) {
                    observer.next({
                      data: JSON.stringify({
                        type: 'chunk',
                        content: visibleChunk,
                      }),
                    } as MessageEvent);
                  }
                }
              },
              character.temperature ?? 0.7,
            );

          // AI 응답 콘텐츠 필터링
          const aiResponseCheck =
            await this.contentFilterService.checkAIResponse(
              fullResponse,
              user.isAdultVerified,
            );
          if (aiResponseCheck.isInappropriate) {
            observer.error(
              new BadRequestException(
                'AI가 부적절한 응답을 생성했습니다. 다시 시도해주세요.',
              ),
            );
            return;
          }

          const parsedResponse =
            this.contextBuilderService.parseStructuredResponse(fullResponse);
          const finalContent = parsedResponse.reply;
          const suggestedReplies = llmContext.includeSuggestions
            ? parsedResponse.suggestions
            : [];

          // AI 메시지 추가
          chat.messages.push({
            sender: 'ai',
            content: finalContent,
            timestamp: new Date(),
            tokensUsed: totalTokensUsed,
            suggestedReplies:
              suggestedReplies.length > 0 ? suggestedReplies : undefined,
          });

          chat.sessionState = this.deriveNextSessionState({
            chat,
            userMessage: content,
            assistantMessage: finalContent,
            character,
            preset,
            llmStatePatch: parsedResponse.statePatch,
          });
          const eventMemoryDraft = this.buildEventMemoryDraft({
            chat,
            previousState: previousSessionState,
            nextState: chat.sessionState,
          });

          // 토큰 사용량 업데이트
          chat.totalTokensUsed += totalTokensUsed;
          chat.lastActivity = new Date();

          // 토큰 차감 (AI 모델 및 응답 길이에 따라 가변 비용 적용)
          const tokenCost = this.calculateTokenCost(
            chat.aiModel,
            totalTokensUsed,
            finalContent.length,
          );

          // 모든 사용자 토큰 차감 (구독자 무제한 대화 제거)
          await this.usersService.useTokens(userId, tokenCost);

          // 캐릭터 사용 횟수 증가
          await this.charactersService.incrementUsageCount(
            chat.character.toString(),
          );

          // 크리에이터 수익 기록 (구독자도 포함 - 수익은 배분됨)
          await this.charactersService.recordCreatorEarning(
            chat.character.toString(),
            tokenCost,
          );

          // 사용자 대화 횟수 증가 및 레벨 업데이트
          const updatedUser = await this.usersService.findById(userId);
          updatedUser.totalConversations += 1;
          await updatedUser.save();

          if (
            updatedUser.totalConversations === 1000 ||
            updatedUser.totalConversations === 10000
          ) {
            await this.usersService.updateCreatorLevel(userId);
          }

          // 채팅 저장
          const savedChat = await chat.save();

          // 사건 기억/메모리 요약 체크 (비동기)
          this.processDerivedMemories(savedChat, eventMemoryDraft).catch(
            (err) => {
              console.error('Failed to process derived memories:', err);
            },
          );

          // 스트리밍 완료 신호 전송 (추천 응답 포함)
          observer.next({
            data: JSON.stringify({
              type: 'done',
              reply: finalContent,
              tokensUsed: totalTokensUsed,
              tokenCost,
              state: chat.sessionState,
              suggestedReplies:
                suggestedReplies.length > 0 ? suggestedReplies : undefined,
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
