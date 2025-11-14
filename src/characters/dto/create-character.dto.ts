import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  Length,
  Min,
  Max,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AIModel, Visibility } from '../schemas/character.schema';

export class ExampleDialogueDto {
  @ApiProperty({ description: '사용자 메시지', example: '안녕하세요!' })
  @IsString()
  @IsNotEmpty()
  user: string;

  @ApiProperty({ description: '캐릭터 응답', example: '안녕하세요! 만나서 반갑습니다 😊' })
  @IsString()
  @IsNotEmpty()
  character: string;
}

export class CreateCharacterDto {
  @ApiProperty({
    description: '캐릭터 이름',
    example: '친절한 AI 비서',
    minLength: 2,
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30, { message: '캐릭터 이름은 2-30자 사이여야 합니다.' })
  name: string;

  @ApiProperty({
    description: '캐릭터 설명 (짧은 소개)',
    example: '항상 친절하고 도움이 되는 AI 비서입니다.',
    minLength: 10,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 200, { message: '캐릭터 설명은 10-200자 사이여야 합니다.' })
  description: string;

  @ApiProperty({
    description: '캐릭터 성격 (상세 설정)',
    example: '당신은 친절하고 전문적인 AI 비서입니다. 항상 공손하고 예의 바른 태도로 답변합니다.',
    minLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @Length(20, 2000, { message: '캐릭터 성격은 최소 20자 이상이어야 합니다.' })
  personality: string;

  @ApiProperty({
    description: '말투 및 대화 스타일',
    example: '존댓말을 사용하며 정중하게 대화합니다. 이모티콘을 적절히 사용해 친근하게 다가갑니다.',
    minLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @Length(20, 1000, { message: '말투 설명은 최소 20자 이상이어야 합니다.' })
  speakingStyle: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  profileImage?: string;

  @ApiPropertyOptional({
    description: '태그 (검색용)',
    example: ['친절함', 'AI', '도우미'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: '첫 인사말',
    example: '안녕하세요! 무엇을 도와드릴까요? 😊',
  })
  @IsString()
  @IsOptional()
  greeting?: string;

  @ApiPropertyOptional({
    description: '시나리오/배경 설정',
    example: '현대 도시의 카페에서 일하는 바리스타',
  })
  @IsString()
  @IsOptional()
  scenario?: string;

  @ApiPropertyOptional({
    description: '대화 예시 (최소 3개 권장)',
    type: [ExampleDialogueDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDialogueDto)
  @IsOptional()
  exampleDialogues?: ExampleDialogueDto[];

  @ApiPropertyOptional({
    description: '성격 특성 태그',
    example: ['kind', 'funny', 'professional'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  characterTraits?: string[];

  @ApiPropertyOptional({
    description: '공개 범위',
    enum: Visibility,
    default: Visibility.PUBLIC,
  })
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @ApiPropertyOptional({
    description: '음성 ID (TTS용)',
    example: 'voice_001',
  })
  @IsString()
  @IsOptional()
  voiceId?: string;

  @ApiPropertyOptional({
    description: 'AI 응답 창의성 (0.0 = 일관적, 1.0 = 창의적)',
    minimum: 0.0,
    maximum: 1.0,
    default: 0.7,
  })
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: '대화 기억 활성화',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  memoryEnabled?: boolean;

  @ApiPropertyOptional({
    description: '최대 기억 메시지 수',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxMemoryMessages?: number;

  @ApiPropertyOptional({
    description: '카테고리',
    example: 'helper',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: '기본 AI 모델',
    enum: AIModel,
    default: AIModel.GPT4,
  })
  @IsEnum(AIModel)
  @IsOptional()
  defaultAIModel?: AIModel;

  @ApiPropertyOptional({
    description: '공개 여부 (deprecated: visibility 사용 권장)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: '성인 컨텐츠 여부',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isAdultContent?: boolean;
}
