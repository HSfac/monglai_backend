import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Character } from '../../characters/schemas/character.schema';
import { World } from '../../worlds/schemas/world.schema';
import { PersonaPreset } from '../../persona-presets/schemas/persona-preset.schema';
import {
  MemorySummary,
  MemoryType,
} from '../../memory/schemas/memory-summary.schema';
import {
  UserNote,
  NoteTargetType,
} from '../../memory/schemas/user-note.schema';
import { Chat, ChatMode, EmbeddedSessionState } from '../schemas/chat.schema';
import {
  buildSystemPrompt,
  buildSuggestionPrompt,
  CharacterData,
  WorldData,
  PresetData,
  SessionStateData,
  SystemPromptParams,
} from '../templates/system-prompt.template';

export interface LLMContext {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  includeSuggestions: boolean;
}

export interface ResponseStatePatch {
  mood?: string;
  scene?: string;
  relationshipLevel?: number;
  lastSceneSummary?: string;
  activeFlags?: string[];
  currentObjective?: string;
}

export interface ContextBuildParams {
  chatId: string;
  characterId: string;
  presetId?: string;
  userId: string;
  userMessage: string;
  recentMessagesLimit?: number;
  memorySummaryLimit?: number;
  eventMemoryLimit?: number;
}

@Injectable()
export class ContextBuilderService {
  constructor(
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @InjectModel(World.name) private worldModel: Model<World>,
    @InjectModel(PersonaPreset.name) private presetModel: Model<PersonaPreset>,
    @InjectModel(MemorySummary.name)
    private memorySummaryModel: Model<MemorySummary>,
    @InjectModel(UserNote.name) private userNoteModel: Model<UserNote>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}

  async buildContext(params: ContextBuildParams): Promise<LLMContext> {
    const {
      chatId,
      characterId,
      presetId,
      userId,
      userMessage,
      recentMessagesLimit,
      memorySummaryLimit = 3,
      eventMemoryLimit = 5,
    } = params;

    // 1. 채팅 정보 가져오기
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat) {
      throw new Error('채팅을 찾을 수 없습니다.');
    }

    // 2. 캐릭터 정보 가져오기
    const character = await this.characterModel.findById(characterId).exec();
    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // 3. 세계관 정보 가져오기 (있을 경우)
    let world: World | null = null;
    if (character.worldId) {
      world = await this.worldModel.findById(character.worldId).exec();
    }

    // 4. 프리셋 정보 가져오기 (있을 경우)
    let preset: PersonaPreset | null = null;
    const effectivePresetId = presetId || chat.presetId;
    if (effectivePresetId) {
      preset = await this.presetModel.findById(effectivePresetId).exec();
    }

    // 5. 메모리 요약 가져오기
    const { summaryMemories, eventMemories, importantFacts } = character.memoryEnabled
      ? await this.getMemories(chatId, memorySummaryLimit, eventMemoryLimit)
      : { summaryMemories: [], eventMemories: [], importantFacts: [] };

    // 6. 유저 노트 가져오기
    const userNotes = await this.getUserNotes(chatId, characterId, userId);

    const effectiveCharacter = this.applyPromptOverrides(
      this.mapCharacterData(character),
      preset?.promptOverrides,
    );

    const effectiveRecentMessagesLimit = character.memoryEnabled
      ? Math.max(
          0,
          Math.min(
            recentMessagesLimit ?? character.maxMemoryMessages ?? 10,
            character.maxMemoryMessages ?? 10,
          ),
        )
      : 0;

    // 7. 최근 메시지 가져오기
    const recentMessages = this.getRecentMessages(
      chat.messages,
      effectiveRecentMessagesLimit,
    );

    // 8. 시스템 프롬프트 생성
    const systemPromptParams: SystemPromptParams = {
      character: effectiveCharacter,
      world: world ? this.mapWorldData(world) : undefined,
      preset: preset ? this.mapPresetData(preset) : undefined,
      sessionState: chat.sessionState
        ? this.mapSessionState(chat.sessionState)
        : undefined,
      memorySummaries: summaryMemories.map((s) => s.summaryText),
      eventMemories: eventMemories.map((memory) =>
        this.formatEventMemory(memory),
      ),
      importantFacts,
      userNotes: userNotes.map((n) => n.content),
      mode: chat.mode as 'story' | 'chat' | 'creator_debug',
    };

    let systemPrompt = buildSystemPrompt(systemPromptParams);

    // 스토리 모드에서만 선택지 생성
    const includeSuggestions = chat.mode === ChatMode.STORY;
    if (includeSuggestions) {
      systemPrompt += buildSuggestionPrompt();
    }

    // 9. 메시지 포맷팅
    const formattedMessages = [
      ...recentMessages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    return {
      systemPrompt,
      messages: formattedMessages,
      includeSuggestions,
    };
  }

  private async getMemories(
    chatId: string,
    summaryLimit: number,
    eventLimit: number,
  ): Promise<{
    summaryMemories: MemorySummary[];
    eventMemories: MemorySummary[];
    importantFacts: string[];
  }> {
    const memories = await this.memorySummaryModel
      .find({ sessionId: new Types.ObjectId(chatId) })
      .sort({ createdAt: -1 })
      .limit(summaryLimit + eventLimit + 6)
      .exec();

    const summaryMemories = memories
      .filter((memory) => memory.memoryType !== MemoryType.EVENT)
      .slice(0, summaryLimit)
      .reverse();
    const eventMemories = memories
      .filter((memory) => memory.memoryType === MemoryType.EVENT)
      .slice(0, eventLimit)
      .reverse();

    return {
      summaryMemories,
      eventMemories,
      importantFacts: this.collectImportantFacts(memories),
    };
  }

  private async getUserNotes(
    chatId: string,
    characterId: string,
    userId: string,
  ): Promise<UserNote[]> {
    return this.userNoteModel
      .find({
        userId: new Types.ObjectId(userId),
        includeInContext: true,
        $or: [
          {
            targetType: NoteTargetType.SESSION,
            targetId: new Types.ObjectId(chatId),
          },
          {
            targetType: NoteTargetType.CHARACTER,
            targetId: new Types.ObjectId(characterId),
          },
        ],
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  private getRecentMessages(messages: any[], limit: number): any[] {
    if (limit <= 0) {
      return [];
    }

    return messages.slice(-limit);
  }

  private formatEventMemory(memory: MemorySummary): string {
    const parts = [memory.summaryText.trim()];

    if (memory.keyEvents?.length > 0) {
      parts.push(`변화: ${memory.keyEvents.slice(0, 3).join(', ')}`);
    }

    if (memory.importantFacts?.length > 0) {
      parts.push(`기억: ${memory.importantFacts.slice(0, 2).join(', ')}`);
    }

    return parts.filter(Boolean).join(' | ');
  }

  private collectImportantFacts(
    memories: MemorySummary[],
    limit: number = 8,
  ): string[] {
    const seen = new Set<string>();
    const facts: string[] = [];

    memories.forEach((memory) => {
      (memory.importantFacts || []).forEach((fact) => {
        const normalized = fact.replace(/\s+/g, ' ').trim();
        const key = normalized.toLowerCase();

        if (!normalized || seen.has(key)) {
          return;
        }

        seen.add(key);
        facts.push(normalized);
      });
    });

    return facts.slice(0, limit);
  }

  private mapCharacterData(character: Character): CharacterData {
    return {
      name: character.name,
      description: character.description,
      personality: character.personality,
      speakingStyle: character.speakingStyle,
      ageDisplay: character.ageDisplay,
      species: character.species,
      role: character.role,
      appearance: character.appearance,
      personalityCore: character.personalityCore,
      backgroundStory: character.backgroundStory,
      characterLikes: character.characterLikes,
      characterDislikes: character.characterDislikes,
      greeting: character.greeting,
      scenario: character.scenario,
      category: character.category,
      temperature: character.temperature,
      exampleDialogues: (character.exampleDialogues || []).map((dialogue) => ({
        user: dialogue.user,
        character: dialogue.character,
      })),
    };
  }

  private mapWorldData(world: World): WorldData {
    return {
      name: world.name,
      description: world.description,
      setting: world.setting,
      rules: world.rules,
    };
  }

  private mapPresetData(preset: PersonaPreset): PresetData {
    return {
      title: preset.title,
      relationshipToUser: preset.relationshipToUser,
      mood: preset.mood,
      speakingTone: preset.speakingTone,
      scenarioIntro: preset.scenarioIntro,
      rules: preset.rules,
      promptOverrides: preset.promptOverrides,
    };
  }

  private mapSessionState(state: EmbeddedSessionState): SessionStateData {
    return {
      mood: state.mood,
      relationshipLevel: state.relationshipLevel,
      scene: state.scene,
      progressCounter: state.progressCounter,
      lastSceneSummary: state.lastSceneSummary,
      activeFlags: state.activeFlags,
      currentObjective: state.currentObjective,
    };
  }

  private applyPromptOverrides(
    character: CharacterData,
    promptOverrides?: Record<string, string>,
  ): CharacterData {
    if (!promptOverrides || Object.keys(promptOverrides).length === 0) {
      return character;
    }

    const nextCharacter: CharacterData = { ...character };
    const arrayKeys = new Set([
      'personalityCore',
      'characterLikes',
      'characterDislikes',
    ]);

    Object.entries(promptOverrides).forEach(([key, value]) => {
      if (!value?.trim()) {
        return;
      }

      if (!(key in nextCharacter)) {
        return;
      }

      if (arrayKeys.has(key)) {
        (nextCharacter as any)[key] = value
          .split(/,|\n/)
          .map((item) => item.trim())
          .filter(Boolean);
        return;
      }

      (nextCharacter as any)[key] = value;
    });

    return nextCharacter;
  }

  parseStructuredResponse(response: string): {
    reply: string;
    suggestions: string[];
    statePatch?: ResponseStatePatch;
  } {
    const suggestionsMatch = response.match(
      /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/,
    );
    const stateMatch = response.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/);
    const statePatch = stateMatch
      ? this.parseStatePatch(stateMatch[1])
      : undefined;
    const strippedResponse = response
      .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/, '')
      .replace(/\[STATE\][\s\S]*?\[\/STATE\]/, '')
      .trim();

    if (suggestionsMatch) {
      const suggestionsText = suggestionsMatch[1];
      const suggestions = suggestionsText
        .split(/\n/)
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((line) => line.length > 0);

      return { reply: strippedResponse, suggestions, statePatch };
    }

    return { reply: strippedResponse, suggestions: [], statePatch };
  }

  private parseStatePatch(rawState: string): ResponseStatePatch | undefined {
    try {
      const normalized = rawState.trim();
      const objectMatch = normalized.match(/\{[\s\S]*\}/);
      const jsonText = objectMatch ? objectMatch[0] : normalized;
      const parsed = JSON.parse(jsonText);

      return {
        mood:
          typeof parsed.mood === 'string' && parsed.mood.trim()
            ? parsed.mood.trim()
            : undefined,
        scene:
          typeof parsed.scene === 'string' && parsed.scene.trim()
            ? parsed.scene.trim()
            : undefined,
        relationshipLevel:
          typeof parsed.relationshipLevel === 'number'
            ? parsed.relationshipLevel
            : undefined,
        lastSceneSummary:
          typeof parsed.lastSceneSummary === 'string' &&
          parsed.lastSceneSummary.trim()
            ? parsed.lastSceneSummary.trim()
            : undefined,
        activeFlags: Array.isArray(parsed.activeFlags)
          ? parsed.activeFlags
              .filter((flag: unknown) => typeof flag === 'string')
              .map((flag: string) => flag.trim())
              .filter(Boolean)
          : undefined,
        currentObjective:
          typeof parsed.currentObjective === 'string' &&
          parsed.currentObjective.trim()
            ? parsed.currentObjective.trim()
            : undefined,
      };
    } catch {
      return undefined;
    }
  }
}
