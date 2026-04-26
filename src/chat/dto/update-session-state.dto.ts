import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';
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

  @ApiPropertyOptional({
    description: '현재 활성화된 플래그들',
    example: ['첫대화완료', '비밀공유'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activeFlags?: string[];

  @ApiPropertyOptional({
    description: '현재 목표/전개 방향',
    example: '조금 더 편하게 대화를 이어간다.',
  })
  @IsString()
  @IsOptional()
  currentObjective?: string;
}
