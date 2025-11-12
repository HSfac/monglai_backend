import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum AIModel {
  GPT4 = 'gpt4',
  CLAUDE3 = 'claude3',
  GROK = 'grok',
  CUSTOM = 'custom',
}

@Schema({ timestamps: true })
export class Character extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  profileImage: string;

  @Prop({ required: true })
  personality: string;

  @Prop({ required: true })
  speakingStyle: string;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ enum: AIModel, default: AIModel.GPT4 })
  defaultAIModel: AIModel;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  tokenEarnings: number;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isAdultContent: boolean;
}

export const CharacterSchema = SchemaFactory.createForClass(Character); 