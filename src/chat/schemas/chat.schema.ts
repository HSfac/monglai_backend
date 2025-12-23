import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AIModel } from '../../characters/schemas/character.schema';

// 채팅 모드 enum
export enum ChatMode {
  STORY = 'story',           // 스토리 모드 (긴 서사, 묘사 비중 높음)
  CHAT = 'chat',             // 라이트 채팅 모드 (짧은 문장, 일상 대화)
  CREATOR_DEBUG = 'creator_debug', // 크리에이터 디버그 모드
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, enum: ['user', 'ai'] })
  sender: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: 0 })
  tokensUsed?: number;

  @Prop({ type: [String], default: [] })
  suggestedReplies?: string[]; // AI가 제안한 유저 응답 선택지
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// 세션 상태 embedded 스키마
@Schema({ _id: false })
export class EmbeddedSessionState {
  @Prop({ default: '평온' })
  mood: string;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  relationshipLevel: number;

  @Prop({ default: '' })
  scene: string;

  @Prop({ type: Number, min: 1, max: 5, default: 1 })
  progressCounter: number;

  @Prop()
  lastSceneSummary: string;
}

export const EmbeddedSessionStateSchema = SchemaFactory.createForClass(EmbeddedSessionState);

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character', required: true })
  character: MongooseSchema.Types.ObjectId;

  @Prop({ enum: AIModel, required: true })
  aiModel: AIModel;

  @Prop({ type: [MessageSchema], default: [] })
  messages: Message[];

  @Prop({ default: 0 })
  totalTokensUsed: number;

  @Prop({ default: Date.now })
  lastActivity: Date;

  // ==================== 고도화 필드 ====================

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PersonaPreset' })
  presetId: MongooseSchema.Types.ObjectId; // 사용 중인 페르소나 프리셋

  @Prop({ enum: ChatMode, default: ChatMode.CHAT })
  mode: ChatMode; // 채팅 모드

  @Prop({ type: EmbeddedSessionStateSchema, default: () => ({}) })
  sessionState: EmbeddedSessionState; // 세션 상태 (embedded)

  @Prop()
  title: string; // 채팅 제목 (유저 설정 또는 자동 생성)

  @Prop({ default: 0 })
  memorySummaryCount: number; // 생성된 메모리 요약 개수
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// 인덱스 설정
ChatSchema.index({ user: 1, lastActivity: -1 });
ChatSchema.index({ character: 1 });
ChatSchema.index({ presetId: 1 }); 