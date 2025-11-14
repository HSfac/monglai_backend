import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: '구독 플랜',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.MONTHLY,
  })
  @IsEnum(SubscriptionPlan, { message: '유효한 구독 플랜을 선택해주세요.' })
  plan: SubscriptionPlan;
}
