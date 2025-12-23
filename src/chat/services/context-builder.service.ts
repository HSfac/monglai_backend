import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Character } from '../../characters/schemas/character.schema';
import { World } from '../../worlds/schemas/world.schema';
import { PersonaPreset } from '../../persona-presets/schemas/persona-preset.schema';
import { MemorySummary } from '../../memory/schemas/memory-summary.schema';
import { UserNote, NoteTargetType } from '../../memory/schemas/user-note.schema';
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

export interface ContextBuildParams {
  chatId: string;
  characterId: string;
  presetId?: string;
  userId: string;
  userMessage: string;
  recentMessagesLimit?: number;
  memorySummaryLimit?: number;
}

@Injectable()
export class ContextBuilderService {
  constructor(
    @InjectModel(Character.name) private characterModel: Model<Character>,
    @InjectModel(World.name) private worldModel: Model<World>,
    @InjectModel(PersonaPreset.name) private presetModel: Model<PersonaPreset>,
    @InjectModel(MemorySummary.name) private memorySummaryModel: Model<MemorySummary>,
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
      recentMessagesLimit = 10,
      memorySummaryLimit = 3,
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
    const memorySummaries = await this.getMemorySummaries(chatId, memorySummaryLimit);

    // 6. 유저 노트 가져오기
    const userNotes = await this.getUserNotes(chatId, characterId, userId);

    // 7. 최근 메시지 가져오기
    const recentMessages = this.getRecentMessages(chat.messages, recentMessagesLimit);

    // 8. 시스템 프롬프트 생성
    const systemPromptParams: SystemPromptParams = {
      character: this.mapCharacterData(character),
      world: world ? this.mapWorldData(world) : undefined,
      preset: preset ? this.mapPresetData(preset) : undefined,
      sessionState: chat.sessionState ? this.mapSessionState(chat.sessionState) : undefined,
      memorySummaries: memorySummaries.map(s => s.summaryText),
      userNotes: userNotes.map(n => n.content),
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
      ...recentMessages.map(msg => ({
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

  private async getMemorySummaries(chatId: string, limit: number): Promise<MemorySummary[]> {
    return this.memorySummaryModel
      .find({ sessionId: new Types.ObjectId(chatId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
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
          { targetType: NoteTargetType.SESSION, targetId: new Types.ObjectId(chatId) },
          { targetType: NoteTargetType.CHARACTER, targetId: new Types.ObjectId(characterId) },
        ],
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  private getRecentMessages(messages: any[], limit: number): any[] {
    return messages.slice(-limit);
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
      lastSceneSummary: state.lastSceneSummary,
    };
  }

  // 응답에서 선택지 파싱
  parseResponseWithSuggestions(response: string): {
    reply: string;
    suggestions: string[];
  } {
    const suggestionsMatch = response.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/);

    if (suggestionsMatch) {
      const reply = response.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/, '').trim();
      const suggestionsText = suggestionsMatch[1];
      const suggestions = suggestionsText
        .split(/\n/)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);

      return { reply, suggestions };
    }

    return { reply: response, suggestions: [] };
  }
}
