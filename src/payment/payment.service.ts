import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentStatus, PaymentType } from './schemas/payment.schema';
import {
  Coupon,
  CouponUsage,
  CouponType,
  DiscountType,
} from '../admin/schemas/coupon.schema';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TossPaymentsService } from './toss-payments.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(CouponUsage.name) private couponUsageModel: Model<CouponUsage>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
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
    const payment = await this.paymentModel
      .findOne({ paymentId: orderId })
      .exec();
    if (!payment) {
      throw new NotFoundException(`결제 정보를 찾을 수 없습니다: ${orderId}`);
    }

    // 금액 확인
    if (payment.amount !== amount) {
      throw new BadRequestException('결제 금액이 일치하지 않습니다.');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      if (payment.metadata?.paymentKey === paymentKey) {
        return payment;
      }

      throw new BadRequestException('이미 완료된 결제입니다.');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        '현재 상태에서는 결제를 승인할 수 없습니다.',
      );
    }

    // Toss Payments 결제 확인
    const tossPayment = await this.tossPaymentsService.confirmPayment(
      paymentKey,
      orderId,
      amount,
    );

    // 결제 정보 업데이트
    payment.status = PaymentStatus.COMPLETED;
    payment.paymentMethod = tossPayment.method || payment.paymentMethod;
    payment.receiptUrl = tossPayment.receipt?.url || tossPayment.receiptUrl;
    payment.metadata = {
      ...(payment.metadata || {}),
      paymentKey,
      approvedAt: tossPayment.approvedAt,
      method: tossPayment.method,
    };

    const savedPayment = await payment.save();

    // 결제 유형에 따른 처리
    if (payment.type === PaymentType.TOKEN_PURCHASE) {
      // 토큰 충전
      await this.usersService.addTokens(
        payment.user.toString(),
        payment.tokens,
      );
      // 알림 전송
      await this.notificationsService.notifyTokenPurchase(
        payment.user.toString(),
        payment.tokens,
      );
    } else if (payment.type === PaymentType.SUBSCRIPTION) {
      // 구독 처리
      const user = await this.usersService.findById(payment.user.toString());

      // 구독 기간 설정 (1개월)
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

      user.isSubscribed = true;
      user.subscriptionEndDate = subscriptionEndDate;
      await user.save();

      // 알림 전송
      await this.notificationsService.notifySubscriptionStart(
        payment.user.toString(),
        '월간 구독',
      );
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
    const paymentKey = payment.metadata?.paymentKey;
    if (!paymentKey) {
      throw new BadRequestException('결제 취소에 필요한 결제 키가 없습니다.');
    }
    await this.tossPaymentsService.cancelPayment(paymentKey, reason);

    // 결제 정보 업데이트
    payment.status = PaymentStatus.REFUNDED;

    const savedPayment = await payment.save();

    // 결제 유형에 따른 처리
    if (payment.type === PaymentType.TOKEN_PURCHASE) {
      // 토큰 차감 (사용한 토큰이 있을 수 있으므로 조건부 처리 필요)
      const user = await this.usersService.findById(payment.user.toString());
      if (user.tokens >= payment.tokens) {
        await this.usersService.useTokens(
          payment.user.toString(),
          payment.tokens,
        );
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

  // ==================== 빌링(구독) 결제 서비스 ====================

  /**
   * 빌링키 발급 (구독용 카드 등록)
   */
  async issueBillingKey(userId: string, authKey: string): Promise<any> {
    const user = await this.usersService.findById(userId);

    // customerKey 생성 (없으면)
    if (!user.customerKey) {
      user.customerKey = `customer_${uuidv4()}`;
      await user.save();
    }

    // Toss Payments에 빌링키 발급 요청
    const billingResponse = await this.tossPaymentsService.issueBillingKey(
      user.customerKey,
      authKey,
    );

    // 사용자에게 빌링키 저장
    user.billingKey = billingResponse.billingKey;
    await user.save();

    return {
      success: true,
      billingKey: billingResponse.billingKey,
      card: billingResponse.card,
    };
  }

  /**
   * 구독 시작 (빌링키로 자동 결제)
   */
  async startSubscription(userId: string, planType: string): Promise<any> {
    const user = await this.usersService.findById(userId);

    if (!user.billingKey) {
      throw new BadRequestException(
        '빌링키가 등록되지 않았습니다. 먼저 카드를 등록해주세요.',
      );
    }

    // 구독 플랜 정보
    const plans = {
      basic: { name: '베이직 플랜', price: 9900, tokens: 300 },
      standard: { name: '스탠다드 플랜', price: 19900, tokens: 1000 },
      premium: { name: '프리미엄 플랜', price: 49900, tokens: 5000 },
    };

    const plan = plans[planType];
    if (!plan) {
      throw new BadRequestException('유효하지 않은 구독 플랜입니다.');
    }

    // 주문 ID 생성
    const orderId = `sub_${uuidv4()}`;

    // 빌링키로 즉시 결제
    const billingPayment = await this.tossPaymentsService.payWithBillingKey(
      user.billingKey,
      user.customerKey,
      plan.price,
      orderId,
      `몽글AI ${plan.name} - 월간 구독`,
    );

    // 결제 정보 저장
    const newPayment = new this.paymentModel({
      user: userId,
      amount: plan.price,
      tokens: plan.tokens,
      status: PaymentStatus.COMPLETED,
      type: PaymentType.SUBSCRIPTION,
      paymentId: orderId,
      paymentMethod: 'billing',
      metadata: {
        billingKey: user.billingKey,
        planType,
        billingPaymentKey: billingPayment.paymentKey,
      },
    });

    await newPayment.save();

    // 구독 상태 업데이트
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

    user.isSubscribed = true;
    user.subscriptionEndDate = subscriptionEndDate;
    await user.save();

    // 구독 시작 시 토큰 즉시 지급
    await this.usersService.addTokens(userId, plan.tokens);

    return {
      success: true,
      subscription: {
        plan: plan.name,
        price: plan.price,
        tokens: plan.tokens,
        startDate: new Date(),
        endDate: subscriptionEndDate,
      },
      payment: billingPayment,
    };
  }

  /**
   * 구독 해지
   */
  async cancelSubscription(userId: string): Promise<any> {
    const user = await this.usersService.findById(userId);

    if (!user.isSubscribed) {
      throw new BadRequestException('활성화된 구독이 없습니다.');
    }

    if (!user.billingKey) {
      throw new BadRequestException('빌링키 정보가 없습니다.');
    }

    // 빌링키 삭제 (자동 결제 중단)
    await this.tossPaymentsService.deleteBillingKey(user.billingKey);

    // 구독 상태 업데이트
    user.isSubscribed = false;
    user.billingKey = undefined as any;
    await user.save();

    return {
      success: true,
      message: '구독이 해지되었습니다.',
    };
  }

  /**
   * 구독 상태 조회
   */
  async getSubscriptionStatus(userId: string): Promise<any> {
    const user = await this.usersService.findById(userId);

    if (!user.isSubscribed) {
      return {
        isSubscribed: false,
        message: '활성화된 구독이 없습니다.',
      };
    }

    return {
      isSubscribed: true,
      subscriptionEndDate: user.subscriptionEndDate,
      daysRemaining: Math.ceil(
        (user.subscriptionEndDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      ),
      hasBillingKey: !!user.billingKey,
    };
  }

  // ==================== 쿠폰 서비스 ====================

  /**
   * 쿠폰 유효성 검사
   */
  async validateCoupon(code: string): Promise<any> {
    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase() })
      .exec();

    if (!coupon) {
      throw new NotFoundException('존재하지 않는 쿠폰 코드입니다.');
    }

    const now = new Date();

    // 활성화 상태 확인
    if (!coupon.isActive) {
      throw new BadRequestException('비활성화된 쿠폰입니다.');
    }

    // 유효기간 확인
    if (now < coupon.startDate) {
      throw new BadRequestException(
        '아직 사용 기간이 시작되지 않은 쿠폰입니다.',
      );
    }

    if (now > coupon.endDate) {
      throw new BadRequestException('사용 기간이 만료된 쿠폰입니다.');
    }

    // 사용 횟수 확인
    if (coupon.maxUsageCount > 0 && coupon.usedCount >= coupon.maxUsageCount) {
      throw new BadRequestException('사용 가능 횟수를 초과한 쿠폰입니다.');
    }

    // 할인 유형에 따른 응답 형식
    let discountType: 'percentage' | 'fixed' | 'tokens';
    if (coupon.type === CouponType.TOKENS) {
      discountType = 'tokens';
    } else if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountType = 'percentage';
    } else {
      discountType = 'fixed';
    }

    return {
      valid: true,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      discountType,
      discountValue: coupon.value,
      description: coupon.description,
    };
  }

  /**
   * 쿠폰 적용
   */
  async applyCoupon(userId: string, code: string): Promise<any> {
    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase() })
      .exec();

    if (!coupon) {
      throw new NotFoundException('존재하지 않는 쿠폰 코드입니다.');
    }

    const now = new Date();

    // 활성화 상태 확인
    if (!coupon.isActive) {
      throw new BadRequestException('비활성화된 쿠폰입니다.');
    }

    // 유효기간 확인
    if (now < coupon.startDate) {
      throw new BadRequestException(
        '아직 사용 기간이 시작되지 않은 쿠폰입니다.',
      );
    }

    if (now > coupon.endDate) {
      throw new BadRequestException('사용 기간이 만료된 쿠폰입니다.');
    }

    // 사용 횟수 확인
    if (coupon.maxUsageCount > 0 && coupon.usedCount >= coupon.maxUsageCount) {
      throw new BadRequestException('사용 가능 횟수를 초과한 쿠폰입니다.');
    }

    // 사용자 중복 사용 확인
    const userObjectId = new Types.ObjectId(userId);
    const userUsageCount = coupon.usedBy.filter(
      (id) => id.toString() === userId,
    ).length;

    if (userUsageCount >= coupon.maxUsagePerUser) {
      throw new BadRequestException('이미 사용한 쿠폰입니다.');
    }

    // 쿠폰 적용 처리
    let message = '';
    let tokensGiven = 0;
    let discountAmount = 0;
    let subscriptionDaysGiven = 0;

    switch (coupon.type) {
      case CouponType.TOKENS:
        // 토큰 즉시 지급
        tokensGiven = coupon.value;
        await this.usersService.addTokens(userId, tokensGiven);
        message = `${tokensGiven.toLocaleString()} 토큰이 지급되었습니다!`;
        break;

      case CouponType.DISCOUNT:
        // 할인 쿠폰은 결제 시 적용되므로 여기서는 정보만 반환
        if (coupon.discountType === DiscountType.PERCENTAGE) {
          discountAmount = coupon.value;
          message = `${coupon.value}% 할인이 적용됩니다.`;
        } else {
          discountAmount = coupon.value;
          message = `${coupon.value.toLocaleString()}원 할인이 적용됩니다.`;
        }
        break;

      case CouponType.SUBSCRIPTION:
        // 구독 기간 연장
        subscriptionDaysGiven = coupon.value;
        const user = await this.usersService.findById(userId);
        const currentEndDate = user.subscriptionEndDate || new Date();
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + subscriptionDaysGiven);
        user.isSubscribed = true;
        user.subscriptionEndDate = newEndDate;
        await user.save();
        message = `구독 기간이 ${subscriptionDaysGiven}일 연장되었습니다!`;
        break;
    }

    // 쿠폰 사용 기록
    coupon.usedCount += 1;
    (coupon.usedBy as any).push(userObjectId);
    await coupon.save();

    // 사용 내역 저장
    const couponUsage = new this.couponUsageModel({
      coupon: coupon._id,
      user: userObjectId,
      discountAmount,
      tokensGiven,
      subscriptionDaysGiven,
    });
    await couponUsage.save();

    // 할인 유형에 따른 응답 형식
    let discountType: 'percentage' | 'fixed' | 'tokens';
    if (coupon.type === CouponType.TOKENS) {
      discountType = 'tokens';
    } else if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountType = 'percentage';
    } else {
      discountType = 'fixed';
    }

    return {
      success: true,
      message,
      code: coupon.code,
      discountType,
      discountValue: coupon.value,
      tokensGiven,
      discountAmount,
      subscriptionDaysGiven,
    };
  }
}
