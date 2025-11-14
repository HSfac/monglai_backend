import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCharacterDto {
  @ApiProperty({
    description: '캐릭터 인증 여부',
    example: true,
  })
  @IsBoolean()
  isVerified: boolean;
}
