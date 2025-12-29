import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum CreatorLevel {
  LEVEL1 = 'level1',   // 입문: 30% 수익, 캐릭터 2개
  LEVEL2 = 'level2',   // 고급: 40% 수익, 캐릭터 5개 (대화 1,000회)
  LEVEL3 = 'level3',   // 전문가: 50% 수익, 캐릭터 무제한 (대화 10,000회)
  PARTNER = 'partner', // 파트너: 60% 수익, 캐릭터 무제한, 프로필 배지 (관리자 승인)
}

// 크리에이터 레벨별 설정
export const CREATOR_LEVEL_CONFIG = {
  [CreatorLevel.LEVEL1]: {
    label: 'Level 1 입문',
    earningRate: 0.30,      // 30% 수익 배분
    maxCharacters: 2,       // 최대 캐릭터 수
    requiredConversations: 0,
  },
  [CreatorLevel.LEVEL2]: {
    label: 'Level 2 고급',
    earningRate: 0.40,      // 40% 수익 배분
    maxCharacters: 5,       // 최대 캐릭터 수
    requiredConversations: 1000,
  },
  [CreatorLevel.LEVEL3]: {
    label: 'Level 3 전문가',
    earningRate: 0.50,      // 50% 수익 배분
    maxCharacters: Infinity, // 무제한
    requiredConversations: 10000,
  },
  [CreatorLevel.PARTNER]: {
    label: '공식 파트너',
    earningRate: 0.60,      // 60% 수익 배분
    maxCharacters: Infinity, // 무제한
    requiredConversations: Infinity, // 관리자 승인 필요
  },
};

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ required: true })
  username: string;

  @Prop()
  profileImage: string;

  @Prop({ default: 0 })
  tokens: number;

  @Prop({ default: 0 })
  totalConversations: number;

  @Prop({ enum: CreatorLevel, default: CreatorLevel.LEVEL1 })
  creatorLevel: CreatorLevel;

  @Prop({ default: 0 })
  popularCharacters: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Character' }], default: [] })
  createdCharacters: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Character' }], default: [] })
  favoriteCharacters: MongooseSchema.Types.ObjectId[];

  @Prop({ default: false })
  isSubscribed: boolean;

  @Prop()
  subscriptionEndDate: Date;

  @Prop()
  billingKey: string;

  @Prop()
  customerKey: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ default: false })
  isAdultVerified: boolean;

  @Prop()
  adultVerifiedAt: Date;

  @Prop({ unique: true, sparse: true })
  verificationCI: string; // Connecting Information (NICE 본인인증)

  @Prop()
  verificationName: string; // 본인인증 시 이름

  @Prop()
  verificationBirthDate: string; // 본인인증 시 생년월일 (YYYYMMDD)

  @Prop({ default: false })
  isSocialLogin: boolean;

  @Prop({ type: Object, default: {} })
  socialProviders: {
    google?: string;
    kakao?: string;
    [key: string]: string | undefined;
  };

  @Prop()
  passwordResetToken: string;

  @Prop()
  passwordResetExpires: Date;
}

export const UserSchema = SchemaFactory.createForClass(User); 