import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: '이메일 또는 사용자 이름',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: '이메일 또는 사용자 이름을 입력해주세요.' })
  emailOrUsername: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password: string;
}
