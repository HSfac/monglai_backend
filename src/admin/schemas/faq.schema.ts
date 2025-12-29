import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum FAQCategory {
  GENERAL = 'general',         // 일반
  ACCOUNT = 'account',         // 계정
  PAYMENT = 'payment',         // 결제
  CHARACTER = 'character',     // 캐릭터
  CREATOR = 'creator',         // 크리에이터
  SUBSCRIPTION = 'subscription', // 구독
  TECHNICAL = 'technical',     // 기술 지원
}

@Schema({ timestamps: true })
export class FAQ extends Document {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ enum: FAQCategory, default: FAQCategory.GENERAL })
  category: FAQCategory;

  @Prop({ default: 0 })
  order: number; // 정렬 순서

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  helpfulCount: number; // 도움이 되었어요 수

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updatedBy: MongooseSchema.Types.ObjectId;
}

export const FAQSchema = SchemaFactory.createForClass(FAQ);
