import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ChatMode } from '../schemas/chat.schema';

export class ChangeModeDto {
  @ApiProperty({
    description: '변경할 채팅 모드',
    enum: ChatMode,
    example: ChatMode.STORY,
  })
  @IsEnum(ChatMode)
  @IsNotEmpty()
  mode: ChatMode;
}
