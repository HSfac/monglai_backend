import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: '사용자 이름',
    example: 'johndoe',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({ message: '사용자 이름을 입력해주세요.' })
  @MinLength(3, { message: '사용자 이름은 최소 3자 이상이어야 합니다.' })
  @MaxLength(20, { message: '사용자 이름은 최대 20자까지 가능합니다.' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '사용자 이름은 영문, 숫자, 언더스코어만 사용 가능합니다.',
  })
  username: string;

  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.',
  })
  password: string;
}
