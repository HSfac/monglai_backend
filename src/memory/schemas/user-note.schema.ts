import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum NoteTargetType {
  SESSION = 'session',     // 특정 세션(채팅)에만 적용
  CHARACTER = 'character', // 해당 캐릭터와의 모든 세션에 적용
}

export enum NoteCategory {
  RULE = 'rule',           // 규칙/설정 (예: "항상 로맨스 분위기 유지")
  MEMORY = 'memory',       // 기억해야 할 사실
  PREFERENCE = 'preference', // 선호 설정
  BOOKMARK = 'bookmark',   // 북마크/중요 포인트
}

@Schema({ timestamps: true })
export class UserNote extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ enum: NoteTargetType, required: true })
  targetType: NoteTargetType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  targetId: MongooseSchema.Types.ObjectId; // Chat ID 또는 Character ID

  @Prop({ required: true })
  content: string; // 노트 내용

  @Prop({ enum: NoteCategory, default: NoteCategory.MEMORY })
  category: NoteCategory;

  @Prop({ default: false })
  isPinned: boolean; // 고정 여부

  @Prop({ default: true })
  includeInContext: boolean; // LLM 컨텍스트에 포함 여부
}

export const UserNoteSchema = SchemaFactory.createForClass(UserNote);

// 인덱스 설정
UserNoteSchema.index({ userId: 1 });
UserNoteSchema.index({ targetType: 1, targetId: 1 });
UserNoteSchema.index({ isPinned: -1 });
