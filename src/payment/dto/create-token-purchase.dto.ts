import { IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTokenPurchaseDto {
  @ApiProperty({
    description: '결제 금액 (원)',
    example: 9900,
    minimum: 1000,
  })
  @IsNumber()
  @IsPositive({ message: '결제 금액은 양수여야 합니다.' })
  @Min(1000, { message: '최소 결제 금액은 1,000원입니다.' })
  amount: number;

  @ApiProperty({
    description: '구매할 토큰 수',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive({ message: '토큰 수는 양수여야 합니다.' })
  @Min(1, { message: '최소 1개 이상의 토큰을 구매해야 합니다.' })
  tokens: number;
}
