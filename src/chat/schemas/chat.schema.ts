import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AIModel } from '../../characters/schemas/character.schema';

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, enum: ['user', 'ai'] })
  sender: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: 0 })
  tokensUsed?: number;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character', required: true })
  character: MongooseSchema.Types.ObjectId;

  @Prop({ enum: AIModel, required: true })
  aiModel: AIModel;

  @Prop({ type: [MessageSchema], default: [] })
  messages: Message[];

  @Prop({ default: 0 })
  totalTokensUsed: number;

  @Prop({ default: Date.now })
  lastActivity: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat); 