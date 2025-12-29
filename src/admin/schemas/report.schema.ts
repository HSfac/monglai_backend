import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ReportType {
  CHARACTER = 'character',
  CHAT = 'chat',
  USER = 'user',
}

export enum ReportReason {
  INAPPROPRIATE = 'inappropriate',     // 부적절한 콘텐츠
  SPAM = 'spam',                       // 스팸
  HARASSMENT = 'harassment',           // 괴롭힘
  COPYRIGHT = 'copyright',             // 저작권 침해
  ADULT_CONTENT = 'adult_content',     // 성인 콘텐츠
  VIOLENCE = 'violence',               // 폭력적 콘텐츠
  OTHER = 'other',                     // 기타
}

export enum ReportStatus {
  PENDING = 'pending',       // 대기중
  REVIEWING = 'reviewing',   // 검토중
  RESOLVED = 'resolved',     // 처리완료
  REJECTED = 'rejected',     // 반려
}

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({ enum: ReportType, required: true })
  type: ReportType;

  @Prop({ enum: ReportReason, required: true })
  reason: ReportReason;

  @Prop({ required: true })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporter: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, refPath: 'targetModel' })
  targetId: MongooseSchema.Types.ObjectId;

  @Prop({ enum: ['User', 'Character', 'Chat'] })
  targetModel: string;

  @Prop({ enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Prop()
  adminNote: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  resolvedBy: MongooseSchema.Types.ObjectId;

  @Prop()
  resolvedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
