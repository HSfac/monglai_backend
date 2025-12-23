import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum PresetMood {
  COMIC = 'comic',       // 코믹/유쾌
  CALM = 'calm',         // 잔잔/평온
  SERIOUS = 'serious',   // 진지/심각
  DARK = 'dark',         // 어두운/우울
  ROMANTIC = 'romantic', // 로맨틱
  TENSE = 'tense',       // 긴장감
}

@Schema({ timestamps: true })
export class PersonaPreset extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Character', required: true })
  characterId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string; // 프리셋 이름: "첫 만남", "연인 관계" 등

  @Prop({ required: true })
  relationshipToUser: string; // 유저와의 관계: 친구, 연인, 고객, 상사 등

  @Prop({ enum: PresetMood, default: PresetMood.CALM })
  mood: PresetMood; // 분위기

  @Prop()
  speakingTone: string; // 이 프리셋에서의 말투 변형

  @Prop()
  scenarioIntro: string; // 시작 상황 설명

  @Prop({ type: [String], default: [] })
  rules: string[]; // 이 프리셋이 지킬 규칙들

  @Prop({ type: Object, default: {} })
  promptOverrides: Record<string, string>; // 캐릭터 시트의 일부를 덮어쓸 내용

  @Prop()
  thumbnailImage: string; // 프리셋 대표 이미지

  @Prop({ default: false })
  isDefault: boolean; // 기본 프리셋 여부

  @Prop({ default: 0 })
  usageCount: number; // 사용 횟수

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  creator: MongooseSchema.Types.ObjectId;
}

export const PersonaPresetSchema = SchemaFactory.createForClass(PersonaPreset);

// 인덱스 설정
PersonaPresetSchema.index({ characterId: 1 });
PersonaPresetSchema.index({ creator: 1 });
PersonaPresetSchema.index({ isDefault: 1 });
