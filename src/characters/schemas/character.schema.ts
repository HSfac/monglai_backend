import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum AIModel {
  GPT4 = 'gpt4',
  CLAUDE3 = 'claude3',
  GROK = 'grok',
  CUSTOM = 'custom',
}

export enum Visibility {
  PUBLIC = 'public',           // 모두에게 공개
  UNLISTED = 'unlisted',       // 링크로만 접근 가능
  PRIVATE = 'private',         // 본인만 접근 가능
}

export interface ExampleDialogue {
  user: string;
  character: string;
}

@Schema({ timestamps: true })
export class Character extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  profileImage: string;

  @Prop({ required: true })
  personality: string;

  @Prop({ required: true })
  speakingStyle: string;

  // ==================== 세계관 & 캐릭터 고도화 필드 ====================

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'World' })
  worldId: MongooseSchema.Types.ObjectId; // 소속 세계관 (선택)

  @Prop()
  ageDisplay: string; // 표기 나이: "20대 초반", "수백 년" 등

  @Prop()
  species: string; // 종족: 인간, 요괴, AI, 엘프 등

  @Prop()
  role: string; // 역할: 신, 학생, 직장인, 용사 등

  @Prop()
  appearance: string; // 외형 묘사

  @Prop({ type: [String], default: [] })
  personalityCore: string[]; // 핵심 성격 키워드: ["밝음", "츤데레", "시니컬"]

  @Prop()
  backgroundStory: string; // 백스토리

  @Prop({ type: [String], default: [] })
  characterLikes: string[]; // 좋아하는 것

  @Prop({ type: [String], default: [] })
  characterDislikes: string[]; // 싫어하는 것

  // ==================== 기존 필드들 ====================

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  greeting: string; // 첫 인사말 (동적 생성 가능)

  @Prop()
  scenario: string; // 캐릭터가 놓인 배경/상황 설정

  @Prop({ type: Array, default: [] })
  exampleDialogues: ExampleDialogue[]; // 대화 예시 (최소 3개 권장)

  @Prop({ type: [String], default: [] })
  characterTraits: string[]; // 성격 특성 태그 (예: kind, funny, adventurous)

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility: Visibility; // 공개 범위

  @Prop()
  voiceId: string; // 음성 ID (향후 TTS 지원용)

  @Prop({ type: Number, min: 0.0, max: 1.0, default: 0.7 })
  temperature: number; // AI 응답 창의성 (0.0 = 일관적, 1.0 = 창의적)

  @Prop({ type: Boolean, default: true })
  memoryEnabled: boolean; // 이전 대화 기억 여부

  @Prop({ type: Number, default: 20 })
  maxMemoryMessages: number; // 기억할 최대 메시지 수

  @Prop()
  category: string; // 카테고리 (예: 판타지, SF, 로맨스, 헬퍼 등)

  // ==================== 기존 필드들 ====================

  @Prop({ default: 0 })
  usageCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  isPublic: boolean; // deprecated: visibility 사용 권장

  @Prop({ enum: AIModel, default: AIModel.GPT4 })
  defaultAIModel: AIModel;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  tokenEarnings: number;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isAdultContent: boolean;
}

export const CharacterSchema = SchemaFactory.createForClass(Character); 