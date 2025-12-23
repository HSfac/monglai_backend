import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteTargetType, NoteCategory } from '../schemas/user-note.schema';

export class CreateNoteDto {
  @ApiProperty({
    description: '노트 내용',
    example: '항상 로맨스 분위기 유지',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500, { message: '노트 내용은 1-500자 사이여야 합니다.' })
  content: string;

  @ApiProperty({
    description: '대상 타입',
    enum: NoteTargetType,
  })
  @IsEnum(NoteTargetType)
  targetType: NoteTargetType;

  @ApiProperty({
    description: '대상 ID (Chat ID 또는 Character ID)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiPropertyOptional({
    description: '노트 카테고리',
    enum: NoteCategory,
    default: NoteCategory.MEMORY,
  })
  @IsEnum(NoteCategory)
  @IsOptional()
  category?: NoteCategory;

  @ApiPropertyOptional({
    description: '고정 여부',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({
    description: 'LLM 컨텍스트에 포함 여부',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeInContext?: boolean;
}
