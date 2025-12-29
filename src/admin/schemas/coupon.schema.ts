import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum CouponType {
  TOKENS = 'tokens',           // 토큰 지급
  DISCOUNT = 'discount',       // 할인율
  SUBSCRIPTION = 'subscription', // 구독 기간
}

export enum DiscountType {
  PERCENTAGE = 'percentage',   // 퍼센트 할인
  FIXED = 'fixed',             // 고정 금액 할인
}

@Schema({ timestamps: true })
export class Coupon extends Document {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ enum: CouponType, required: true })
  type: CouponType;

  @Prop({ enum: DiscountType })
  discountType: DiscountType;

  @Prop({ required: true })
  value: number; // 토큰 수 / 할인율 / 구독 일수

  @Prop()
  minPurchaseAmount: number; // 최소 구매 금액

  @Prop()
  maxDiscountAmount: number; // 최대 할인 금액

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: 0 })
  maxUsageCount: number; // 0 = 무제한

  @Prop({ default: 0 })
  usedCount: number;

  @Prop({ default: 1 })
  maxUsagePerUser: number; // 유저당 최대 사용 횟수

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  usedBy: MongooseSchema.Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// 쿠폰 사용 내역
@Schema({ timestamps: true })
export class CouponUsage extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Coupon', required: true })
  coupon: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop()
  discountAmount: number;

  @Prop()
  tokensGiven: number;

  @Prop()
  subscriptionDaysGiven: number;
}

export const CouponUsageSchema = SchemaFactory.createForClass(CouponUsage);
