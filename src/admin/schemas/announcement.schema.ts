import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum AnnouncementType {
  NOTICE = 'notice',         // 공지사항
  EVENT = 'event',           // 이벤트
  MAINTENANCE = 'maintenance', // 점검 안내
  UPDATE = 'update',         // 업데이트
}

export enum AnnouncementPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true })
export class Announcement extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: AnnouncementType, default: AnnouncementType.NOTICE })
  type: AnnouncementType;

  @Prop({ enum: AnnouncementPriority, default: AnnouncementPriority.NORMAL })
  priority: AnnouncementPriority;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0 })
  viewCount: number;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);
