import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('결제')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('token-packages')
  @ApiOperation({ summary: '토큰 패키지 목록 조회' })
  @ApiResponse({ status: 200, description: '토큰 패키지 목록 조회 성공' })
  async getTokenPackages() {
    return this.paymentService.getTokenPackages();
  }

  @UseGuards(JwtAuthGuard)
  @Post('buy-tokens')
  @ApiBearerAuth()
  @ApiOperation({ summary: '토큰 구매' })
  @ApiResponse({ status: 201, description: '토큰 구매 요청 성공' })
  async buyTokens(
    @Request() req,
    @Body() buyTokensDto: { amount: number; tokens: number },
  ) {
    return this.paymentService.createTokenPurchase(
      req.user.userId,
      buyTokensDto.amount,
      buyTokensDto.tokens,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 신청' })
  @ApiResponse({ status: 201, description: '구독 신청 요청 성공' })
  async subscribe(@Request() req, @Body() subscribeDto: { amount: number }) {
    return this.paymentService.createSubscription(
      req.user.userId,
      subscribeDto.amount,
    );
  }

  @Post('confirm')
  @ApiOperation({ summary: '결제 확인' })
  @ApiResponse({ status: 200, description: '결제 확인 성공' })
  async confirmPayment(
    @Body() confirmDto: { paymentKey: string; orderId: string; amount: number },
  ) {
    return this.paymentService.confirmPayment(
      confirmDto.paymentKey,
      confirmDto.orderId,
      confirmDto.amount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 취소' })
  @ApiResponse({ status: 200, description: '결제 취소 성공' })
  async cancelPayment(
    @Param('id') id: string,
    @Body() cancelDto: { reason: string },
  ) {
    return this.paymentService.cancelPayment(id, cancelDto.reason);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 내역 조회' })
  @ApiResponse({ status: 200, description: '결제 내역 조회 성공' })
  async getPaymentHistory(@Request() req) {
    return this.paymentService.findByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 상세 조회' })
  @ApiResponse({ status: 200, description: '결제 상세 조회 성공' })
  @ApiResponse({ status: 404, description: '결제 정보를 찾을 수 없음' })
  async getPaymentDetail(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  // ==================== 빌링(구독) 결제 API ====================

  @UseGuards(JwtAuthGuard)
  @Post('billing/issue')
  @ApiBearerAuth()
  @ApiOperation({ summary: '빌링키 발급 (구독용 카드 등록)' })
  @ApiResponse({ status: 201, description: '빌링키 발급 성공' })
  async issueBillingKey(@Request() req, @Body() issueDto: { authKey: string }) {
    return this.paymentService.issueBillingKey(req.user.userId, issueDto.authKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('billing/subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 시작 (빌링키로 자동 결제)' })
  @ApiResponse({ status: 201, description: '구독 시작 성공' })
  async startSubscription(@Request() req, @Body() subscribeDto: { planType: string }) {
    return this.paymentService.startSubscription(req.user.userId, subscribeDto.planType);
  }

  @UseGuards(JwtAuthGuard)
  @Post('billing/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 해지' })
  @ApiResponse({ status: 200, description: '구독 해지 성공' })
  async cancelSubscription(@Request() req) {
    return this.paymentService.cancelSubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('billing/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 상태 조회' })
  @ApiResponse({ status: 200, description: '구독 상태 조회 성공' })
  async getSubscriptionStatus(@Request() req) {
    return this.paymentService.getSubscriptionStatus(req.user.userId);
  }
} 