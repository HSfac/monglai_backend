import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Visibility } from '../../characters/schemas/character.schema';

@Schema({ timestamps: true })
export class World extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  setting: string; // 시대, 장소, 배경 설정

  @Prop({ type: [String], default: [] })
  rules: string[]; // 세계관 규칙

  @Prop({ type: [String], default: [] })
  tags: string[]; // 검색용 태그

  @Prop()
  coverImage: string; // 대표 이미지

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility: Visibility;

  @Prop({ default: false })
  isAdultContent: boolean;

  @Prop({ default: 0 })
  characterCount: number; // 소속 캐릭터 수 (캐싱용)

  @Prop({ default: 0 })
  usageCount: number; // 사용 횟수

  @Prop({ default: 0 })
  likes: number;
}

export const WorldSchema = SchemaFactory.createForClass(World);

// 인덱스 설정
WorldSchema.index({ creator: 1 });
WorldSchema.index({ tags: 1 });
WorldSchema.index({ visibility: 1 });
WorldSchema.index({ usageCount: -1 });
