import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TossPaymentsService } from './toss-payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, TossPaymentsService],
  exports: [PaymentService],
})
export class PaymentModule {} 