import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentType {
  TOKEN_PURCHASE = 'token_purchase',
  SUBSCRIPTION = 'subscription',
}

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  tokens: number;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ enum: PaymentType, required: true })
  type: PaymentType;

  @Prop()
  paymentId: string;

  @Prop()
  paymentMethod: string;

  @Prop()
  receiptUrl: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment); 