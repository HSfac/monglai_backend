import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema()
export class MessageRange {
  @Prop({ required: true })
  start: number; // 시작 메시지 번호

  @Prop({ required: true })
  end: number; // 끝 메시지 번호
}

export const MessageRangeSchema = SchemaFactory.createForClass(MessageRange);

@Schema({ timestamps: true })
export class MemorySummary extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Chat', required: true })
  sessionId: MongooseSchema.Types.ObjectId; // 채팅 세션 참조

  @Prop({ type: MessageRangeSchema, required: true })
  messageRange: MessageRange; // 요약된 메시지 범위

  @Prop({ required: true })
  summaryText: string; // 요약 내용

  @Prop({ type: [String], default: [] })
  keyEvents: string[]; // 핵심 이벤트 목록

  @Prop()
  emotionalTone: string; // 전체 분위기/감정 톤

  @Prop({ type: Object, default: {} })
  characterMentions: Record<string, number>; // 언급된 캐릭터/인물 빈도

  @Prop({ type: [String], default: [] })
  importantFacts: string[]; // 기억해야 할 중요 사실들

  // timestamps: true로 자동 생성되는 필드들 (타입 정의용)
  createdAt: Date;
  updatedAt: Date;
}

export const MemorySummarySchema = SchemaFactory.createForClass(MemorySummary);

// 인덱스 설정
MemorySummarySchema.index({ sessionId: 1 });
MemorySummarySchema.index({ createdAt: -1 });
