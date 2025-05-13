import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentStatus, PaymentType } from './schemas/payment.schema';
import { UsersService } from '../users/users.service';
import { TossPaymentsService } from './toss-payments.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    private usersService: UsersService,
    private tossPaymentsService: TossPaymentsService,
  ) {}

  async createTokenPurchase(
    userId: string,
    amount: number,
    tokens: number,
  ): Promise<{ payment: Payment; paymentUrl: string }> {
    // 주문 ID 생성
    const orderId = `token_${uuidv4()}`;
    
    // 결제 정보 생성
    const newPayment = new this.paymentModel({
      user: userId,
      amount,
      tokens,
      status: PaymentStatus.PENDING,
      type: PaymentType.TOKEN_PURCHASE,
      paymentId: orderId,
    });
    
    const savedPayment = await newPayment.save();
    
    // Toss Payments 결제 생성
    const tossPayment = await this.tossPaymentsService.createPayment(
      amount,
      orderId,
      `몽글AI 토큰 ${tokens}개`,
    );
    
    return {
      payment: savedPayment,
      paymentUrl: tossPayment.checkout.url,
    };
  }

  async createSubscription(
    userId: string,
    amount: number,
  ): Promise<{ payment: Payment; paymentUrl: string }> {
    // 주문 ID 생성
    const orderId = `sub_${uuidv4()}`;
    
    // 결제 정보 생성
    const newPayment = new this.paymentModel({
      user: userId,
      amount,
      tokens: 0, // 구독은 토큰이 아닌 기간으로 계산
      status: PaymentStatus.PENDING,
      type: PaymentType.SUBSCRIPTION,
      paymentId: orderId,
    });
    
    const savedPayment = await newPayment.save();
    
    // Toss Payments 결제 생성
    const tossPayment = await this.tossPaymentsService.createPayment(
      amount,
      orderId,
      '몽글AI 월 구독',
    );
    
    return {
      payment: savedPayment,
      paymentUrl: tossPayment.checkout.url,
    };
  }

  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<Payment> {
    // 결제 정보 조회
    const payment = await this.paymentModel.findOne({ paymentId: orderId }).exec();
    if (!payment) {
      throw new NotFoundException(`결제 정보를 찾을 수 없습니다: ${orderId}`);
    }
    
    // 금액 확인
    if (payment.amount !== amount) {
      throw new BadRequestException('결제 금액이 일치하지 않습니다.');
    }
    
    // Toss Payments 결제 확인
    const tossPayment = await this.tossPaymentsService.confirmPayment(
      paymentKey,
      orderId,
      amount,
    );
    
    // 결제 정보 업데이트
    payment.status = PaymentStatus.COMPLETED;
    payment.paymentMethod = tossPayment.method;
    payment.receiptUrl = tossPayment.receipt.url;
    payment.metadata = {
      paymentKey,
      approvedAt: tossPayment.approvedAt,
      method: tossPayment.method,
    };
    
    const savedPayment = await payment.save();
    
    // 결제 유형에 따른 처리
    if (payment.type === PaymentType.TOKEN_PURCHASE) {
      // 토큰 충전
      await this.usersService.addTokens(payment.user.toString(), payment.tokens);
    } else if (payment.type === PaymentType.SUBSCRIPTION) {
      // 구독 처리
      const user = await this.usersService.findById(payment.user.toString());
      
      // 구독 기간 설정 (1개월)
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
      
      user.isSubscribed = true;
      user.subscriptionEndDate = subscriptionEndDate;
      await user.save();
    }
    
    return savedPayment;
  }

  async cancelPayment(paymentId: string, reason: string): Promise<Payment> {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) {
      throw new NotFoundException(`결제 정보를 찾을 수 없습니다: ${paymentId}`);
    }
    
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('완료된 결제만 취소할 수 있습니다.');
    }
    
    // Toss Payments 결제 취소
    const paymentKey = payment.metadata.paymentKey;
    await this.tossPaymentsService.cancelPayment(paymentKey, reason);
    
    // 결제 정보 업데이트
    payment.status = PaymentStatus.REFUNDED;
    
    const savedPayment = await payment.save();
    
    // 결제 유형에 따른 처리
    if (payment.type === PaymentType.TOKEN_PURCHASE) {
      // 토큰 차감 (사용한 토큰이 있을 수 있으므로 조건부 처리 필요)
      const user = await this.usersService.findById(payment.user.toString());
      if (user.tokens >= payment.tokens) {
        await this.usersService.useTokens(payment.user.toString(), payment.tokens);
      }
    } else if (payment.type === PaymentType.SUBSCRIPTION) {
      // 구독 취소
      const user = await this.usersService.findById(payment.user.toString());
      user.isSubscribed = false;
      await user.save();
    }
    
    return savedPayment;
  }

  async findByUser(userId: string): Promise<Payment[]> {
    return this.paymentModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`결제 정보를 찾을 수 없습니다: ${id}`);
    }
    return payment;
  }

  async getTokenPackages(): Promise<any[]> {
    // 토큰 패키지 정보 (실제로는 DB에서 가져올 수 있음)
    return [
      { id: 'basic', name: '기본 패키지', tokens: 100, price: 9900 },
      { id: 'standard', name: '스탠다드 패키지', tokens: 300, price: 19900 },
      { id: 'premium', name: '프리미엄 패키지', tokens: 1000, price: 49900 },
    ];
  }
} 