import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: '메시지 내용',
    example: '안녕하세요! 오늘 날씨가 어때요?',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty({ message: '메시지 내용을 입력해주세요.' })
  @Length(1, 5000, { message: '메시지는 1-5000자 사이여야 합니다.' })
  content: string;
}
