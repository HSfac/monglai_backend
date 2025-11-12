import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class CreatorEarnings extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character', required: true })
  character: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  conversationCount: number;

  @Prop({ required: true, default: 0 })
  tokensEarned: number;

  @Prop({ required: true })
  period: string; // 예: "2025-01"

  @Prop({ default: false })
  isPaid: boolean;

  @Prop()
  paidAt: Date;
}

export const CreatorEarningsSchema = SchemaFactory.createForClass(CreatorEarnings);
