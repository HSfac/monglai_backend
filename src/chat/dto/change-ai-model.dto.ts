import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AIModel } from '../../characters/schemas/character.schema';

export class ChangeAIModelDto {
  @ApiProperty({
    description: '변경할 AI 모델',
    enum: AIModel,
    example: AIModel.GPT4,
  })
  @IsEnum(AIModel, { message: '유효한 AI 모델을 선택해주세요.' })
  aiModel: AIModel;
}
