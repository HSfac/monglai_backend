import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '../../characters/schemas/character.schema';

export class CreateWorldDto {
  @ApiProperty({
    description: '세계관 이름',
    example: '신화 공존 사회',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: '세계관 이름은 2-50자 사이여야 합니다.' })
  name: string;

  @ApiProperty({
    description: '세계관 설명',
    example: '현대 사회에 신화 속 존재들이 함께 살아가는 세계입니다.',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500, { message: '세계관 설명은 10-500자 사이여야 합니다.' })
  description: string;

  @ApiPropertyOptional({
    description: '세계관 배경 설정 (시대, 장소 등)',
    example: '2024년 현대 서울, 요괴와 인간이 공존하는 도시',
  })
  @IsString()
  @IsOptional()
  setting?: string;

  @ApiPropertyOptional({
    description: '세계관 규칙',
    example: ['요괴는 인간에게 정체를 숨겨야 한다', '마법은 밤에만 사용 가능하다'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rules?: string[];

  @ApiPropertyOptional({
    description: '태그 (검색용)',
    example: ['판타지', '현대', '로맨스'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: '대표 이미지 URL',
    example: 'https://example.com/world-cover.jpg',
  })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({
    description: '공개 범위',
    enum: Visibility,
    default: Visibility.PUBLIC,
  })
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @ApiPropertyOptional({
    description: '성인 컨텐츠 여부',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isAdultContent?: boolean;
}
