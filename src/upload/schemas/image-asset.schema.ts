import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ImageAssetType {
  PROFILE = 'profile',       // 캐릭터 프로필 이미지
  ILLUSTRATION = 'illustration', // 일러스트
  BACKGROUND = 'background', // 배경 이미지
  PRESET = 'preset',         // 프리셋 대표 이미지
  WORLD_COVER = 'world_cover', // 세계관 커버
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class ImageAsset extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'World' })
  worldId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character' })
  characterId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PersonaPreset' })
  presetId?: MongooseSchema.Types.ObjectId;

  @Prop({ enum: ImageAssetType, default: ImageAssetType.OTHER })
  type: ImageAssetType;

  @Prop({ required: true })
  url: string;

  @Prop()
  fileName: string;

  @Prop()
  fileSize: number; // bytes

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  description: string;

  @Prop({ default: false })
  isAdultContent: boolean;

  @Prop({ default: 0 })
  usageCount: number;
}

export const ImageAssetSchema = SchemaFactory.createForClass(ImageAsset);

// 인덱스 설정
ImageAssetSchema.index({ ownerId: 1 });
ImageAssetSchema.index({ worldId: 1 });
ImageAssetSchema.index({ characterId: 1 });
ImageAssetSchema.index({ presetId: 1 });
ImageAssetSchema.index({ type: 1 });
