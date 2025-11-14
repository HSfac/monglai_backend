import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BanUserDto {
  @ApiProperty({
    description: '차단 여부',
    example: true,
  })
  @IsBoolean()
  isBanned: boolean;

  @ApiPropertyOptional({
    description: '차단 사유',
    example: '부적절한 콘텐츠 생성',
  })
  @IsString()
  @IsOptional()
  banReason?: string;
}
