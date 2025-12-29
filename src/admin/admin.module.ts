import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { CharactersModule } from '../characters/characters.module';
import { PaymentModule } from '../payment/payment.module';
import { ChatModule } from '../chat/chat.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Character, CharacterSchema } from '../characters/schemas/character.schema';
import { Payment, PaymentSchema } from '../payment/schemas/payment.schema';
import { Chat, ChatSchema } from '../chat/schemas/chat.schema';
import { Report, ReportSchema } from './schemas/report.schema';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';
import { Coupon, CouponSchema, CouponUsage, CouponUsageSchema } from './schemas/coupon.schema';
import { Settlement, SettlementSchema, CreatorEarning, CreatorEarningSchema } from './schemas/settlement.schema';
import { FAQ, FAQSchema } from './schemas/faq.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Character.name, schema: CharacterSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Report.name, schema: ReportSchema },
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponUsage.name, schema: CouponUsageSchema },
      { name: Settlement.name, schema: SettlementSchema },
      { name: CreatorEarning.name, schema: CreatorEarningSchema },
      { name: FAQ.name, schema: FAQSchema },
    ]),
    UsersModule,
    CharactersModule,
    PaymentModule,
    ChatModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
