import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: {
    getTokenPackages: jest.Mock;
    createTokenPurchase: jest.Mock;
    confirmPayment: jest.Mock;
    applyCoupon: jest.Mock;
  };

  beforeEach(() => {
    paymentService = {
      getTokenPackages: jest.fn(),
      createTokenPurchase: jest.fn(),
      confirmPayment: jest.fn(),
      applyCoupon: jest.fn(),
    };

    controller = new PaymentController(
      paymentService as unknown as PaymentService,
    );
  });

  it('returns token packages', async () => {
    const packages = [{ id: 'starter', amount: 4900, tokens: 50 }];
    paymentService.getTokenPackages.mockResolvedValue(packages);

    await expect(controller.getTokenPackages()).resolves.toEqual(packages);
    expect(paymentService.getTokenPackages).toHaveBeenCalledTimes(1);
  });

  it('creates a token purchase for the authenticated user', async () => {
    const req = { user: { userId: 'user-1' } };
    const dto = { amount: 9900, tokens: 120 };
    const result = { orderId: 'order-1', amount: 9900 };

    paymentService.createTokenPurchase.mockResolvedValue(result);

    await expect(controller.buyTokens(req, dto)).resolves.toEqual(result);

    expect(paymentService.createTokenPurchase).toHaveBeenCalledWith(
      'user-1',
      9900,
      120,
    );
  });

  it('confirms a payment with the request payload', async () => {
    const dto = {
      paymentKey: 'pay-key',
      orderId: 'order-1',
      amount: 9900,
    };
    const result = { success: true };

    paymentService.confirmPayment.mockResolvedValue(result);

    await expect(controller.confirmPayment(dto)).resolves.toEqual(result);

    expect(paymentService.confirmPayment).toHaveBeenCalledWith(
      'pay-key',
      'order-1',
      9900,
    );
  });

  it('applies a coupon for the authenticated user', async () => {
    const req = { user: { userId: 'user-1' } };
    const result = { discountAmount: 1000 };

    paymentService.applyCoupon.mockResolvedValue(result);

    await expect(
      controller.applyCoupon(req, { code: 'WELCOME1000' }),
    ).resolves.toEqual(result);

    expect(paymentService.applyCoupon).toHaveBeenCalledWith(
      'user-1',
      'WELCOME1000',
    );
  });
});
