import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum SettlementStatus {
  PENDING = 'pending',       // 정산 대기
  PROCESSING = 'processing', // 처리중
  COMPLETED = 'completed',   // 완료
  REJECTED = 'rejected',     // 거절
  CANCELLED = 'cancelled',   // 취소
}

export enum SettlementPeriod {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class Settlement extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  amount: number; // 정산 금액 (원)

  @Prop({ required: true })
  tokenAmount: number; // 토큰 수

  @Prop({ required: true })
  earningRate: number; // 적용된 수익률

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({ enum: SettlementStatus, default: SettlementStatus.PENDING })
  status: SettlementStatus;

  @Prop()
  bankName: string;

  @Prop()
  accountNumber: string;

  @Prop()
  accountHolder: string;

  @Prop()
  processedAt: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  processedBy: MongooseSchema.Types.ObjectId;

  @Prop()
  adminNote: string;

  @Prop()
  transactionId: string; // 송금 거래 ID
}

export const SettlementSchema = SchemaFactory.createForClass(Settlement);

// 크리에이터 수익 내역 (개별 수익 기록)
@Schema({ timestamps: true })
export class CreatorEarning extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character', required: true })
  character: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: MongooseSchema.Types.ObjectId; // 대화한 유저

  @Prop({ required: true })
  tokensSpent: number; // 사용자가 소비한 토큰

  @Prop({ required: true })
  tokensEarned: number; // 크리에이터가 얻은 토큰

  @Prop({ required: true })
  earningRate: number; // 적용된 수익률

  @Prop({ default: false })
  isSettled: boolean; // 정산 완료 여부

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Settlement' })
  settlement: MongooseSchema.Types.ObjectId;
}

export const CreatorEarningSchema = SchemaFactory.createForClass(CreatorEarning);
