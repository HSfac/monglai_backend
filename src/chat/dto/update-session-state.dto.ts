import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSessionStateDto {
  @ApiPropertyOptional({
    description: '캐릭터의 현재 감정 상태',
    example: '기쁨',
  })
  @IsString()
  @IsOptional()
  mood?: string;

  @ApiPropertyOptional({
    description: '관계 레벨 (0-5)',
    example: 2,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  relationshipLevel?: number;

  @ApiPropertyOptional({
    description: '현재 장면/상황',
    example: '카페에서 대화 중',
  })
  @IsString()
  @IsOptional()
  scene?: string;

  @ApiPropertyOptional({
    description: '진행도 카운터 (1-5)',
    example: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  progressCounter?: number;

  @ApiPropertyOptional({
    description: '마지막 씬 요약',
    example: '주인공과 첫 만남을 가졌다.',
  })
  @IsString()
  @IsOptional()
  lastSceneSummary?: string;
}
