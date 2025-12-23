import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PresetMood } from '../schemas/persona-preset.schema';

export class CreatePresetDto {
  @ApiProperty({
    description: '프리셋 제목',
    example: '첫 만남',
    minLength: 2,
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30, { message: '프리셋 제목은 2-30자 사이여야 합니다.' })
  title: string;

  @ApiProperty({
    description: '유저와의 관계',
    example: '친구',
  })
  @IsString()
  @IsNotEmpty()
  relationshipToUser: string;

  @ApiPropertyOptional({
    description: '분위기',
    enum: PresetMood,
    default: PresetMood.CALM,
  })
  @IsEnum(PresetMood)
  @IsOptional()
  mood?: PresetMood;

  @ApiPropertyOptional({
    description: '말투 변형',
    example: '존댓말, 약간 쑥스러워하며 말함',
  })
  @IsString()
  @IsOptional()
  speakingTone?: string;

  @ApiPropertyOptional({
    description: '시작 상황 설명',
    example: '학교 옥상에서 우연히 마주친 상황. 서로 어색한 분위기.',
  })
  @IsString()
  @IsOptional()
  scenarioIntro?: string;

  @ApiPropertyOptional({
    description: '프리셋 규칙',
    example: ['항상 존댓말 사용', '신체 접촉 자제'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rules?: string[];

  @ApiPropertyOptional({
    description: '캐릭터 시트 덮어쓰기',
    example: { personality: '평소보다 더 수줍어함' },
  })
  @IsObject()
  @IsOptional()
  promptOverrides?: Record<string, string>;

  @ApiPropertyOptional({
    description: '프리셋 대표 이미지 URL',
    example: 'https://example.com/preset-thumbnail.jpg',
  })
  @IsString()
  @IsOptional()
  thumbnailImage?: string;

  @ApiPropertyOptional({
    description: '기본 프리셋 여부',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
