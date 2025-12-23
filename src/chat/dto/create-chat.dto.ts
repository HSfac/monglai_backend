import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AIModel } from '../../characters/schemas/character.schema';
import { ChatMode } from '../schemas/chat.schema';

export class CreateChatDto {
  @ApiProperty({
    description: '캐릭터 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  characterId: string;

  @ApiPropertyOptional({
    description: '사용할 AI 모델',
    enum: AIModel,
  })
  @IsEnum(AIModel)
  @IsOptional()
  aiModel?: AIModel;

  @ApiPropertyOptional({
    description: '페르소나 프리셋 ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  @IsOptional()
  presetId?: string;

  @ApiPropertyOptional({
    description: '채팅 모드',
    enum: ChatMode,
    default: ChatMode.CHAT,
  })
  @IsEnum(ChatMode)
  @IsOptional()
  mode?: ChatMode;

  @ApiPropertyOptional({
    description: '채팅 제목',
    example: '첫 만남',
  })
  @IsString()
  @IsOptional()
  title?: string;
}
