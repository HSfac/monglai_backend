import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class SessionState extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Chat', required: true, unique: true })
  chatId: MongooseSchema.Types.ObjectId;

  @Prop({ default: '평온' })
  mood: string; // 현재 분위기: 긴장, 평온, 갈등, 로맨틱 등

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  relationshipLevel: number; // 관계 레벨 0~5

  @Prop({ default: '' })
  scene: string; // 현재 장면: "신사 입구", "학교 옥상" 등

  @Prop({ type: Number, min: 1, max: 5, default: 1 })
  progressCounter: number; // 1~5 카운터 (5가 되면 요약 후 리셋)

  @Prop()
  lastSceneSummary: string; // 최근 5턴 요약

  @Prop({ type: Object, default: {} })
  customStats: Record<string, number | string>; // 커스텀 상태값 (예: 호감도, 신뢰도 등)

  @Prop({ type: [String], default: [] })
  activeFlags: string[]; // 활성화된 플래그들 (예: "첫키스완료", "비밀공유" 등)

  @Prop()
  currentObjective: string; // 현재 목표/퀘스트 (스토리 모드용)
}

export const SessionStateSchema = SchemaFactory.createForClass(SessionState);

// 인덱스 설정
SessionStateSchema.index({ chatId: 1 }, { unique: true });
