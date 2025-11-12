import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TossPaymentsService {
  private readonly secretKey: string;
  private readonly clientKey: string;
  private readonly apiUrl: string = 'https://api.tosspayments.com/v1';

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY') || '';
    this.clientKey = this.configService.get<string>('TOSS_PAYMENTS_CLIENT_KEY') || '';
  }

  async createPayment(amount: number, orderId: string, orderName: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          amount,
          orderId,
          orderName,
          successUrl: `${process.env.FRONTEND_URL}/payment/success`,
          failUrl: `${process.env.FRONTEND_URL}/payment/fail`,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`결제 생성 실패: ${error.message}`);
    }
  }

  async confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/payments/confirm`,
        {
          paymentKey,
          orderId,
          amount,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`결제 확인 실패: ${error.message}`);
    }
  }

  async cancelPayment(paymentKey: string, cancelReason: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/payments/${paymentKey}/cancel`,
        {
          cancelReason,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`결제 취소 실패: ${error.message}`);
    }
  }

  async getPayment(paymentKey: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.get(`${this.apiUrl}/payments/${paymentKey}`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`결제 정보 조회 실패: ${error.message}`);
    }
  }

  // ==================== 빌링(구독) 결제 API ====================

  /**
   * 빌링키 발급 (구독 결제용)
   * @param customerKey 고객 고유 키
   * @param authKey 카드 인증 키
   */
  async issueBillingKey(customerKey: string, authKey: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/billing/authorizations/issue`,
        {
          customerKey,
          authKey,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`빌링키 발급 실패: ${error.message}`);
    }
  }

  /**
   * 빌링키로 결제 (자동 결제)
   * @param billingKey 빌링키
   * @param customerKey 고객 고유 키
   * @param amount 결제 금액
   * @param orderId 주문 ID
   * @param orderName 주문명
   */
  async payWithBillingKey(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderId: string,
    orderName: string,
  ): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/billing/${billingKey}`,
        {
          customerKey,
          amount,
          orderId,
          orderName,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new Error(`빌링 결제 실패: ${error.message}`);
    }
  }

  /**
   * 빌링키 조회
   * @param billingKey 빌링키
   */
  async getBillingKey(billingKey: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.get(`${this.apiUrl}/billing/authorizations/${billingKey}`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`빌링키 조회 실패: ${error.message}`);
    }
  }

  /**
   * 빌링키 삭제 (구독 해지)
   * @param billingKey 빌링키
   */
  async deleteBillingKey(billingKey: string): Promise<any> {
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await axios.delete(`${this.apiUrl}/billing/authorizations/${billingKey}`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`빌링키 삭제 실패: ${error.message}`);
    }
  }
} 