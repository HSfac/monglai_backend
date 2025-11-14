import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AIModel } from '../../characters/schemas/character.schema';

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
}
