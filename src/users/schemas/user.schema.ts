import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum CreatorLevel {
  LEVEL1 = 'level1',
  LEVEL2 = 'level2',
  LEVEL3 = 'level3',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
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
}

export const UserSchema = SchemaFactory.createForClass(User); 