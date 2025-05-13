import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
        tokens: user.tokens,
        creatorLevel: user.creatorLevel,
        isSubscribed: user.isSubscribed,
      },
    };
  }

  async register(email: string, password: string, username: string) {
    // 이메일 중복 확인
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('이미 등록된 이메일입니다.');
    }

    // 비밀번호 유효성 검사
    if (password.length < 6) {
      throw new BadRequestException('비밀번호는 최소 6자 이상이어야 합니다.');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 사용자 생성
    const newUser = await this.usersService.create({
      email,
      password: hashedPassword,
      username,
      tokens: 10, // 신규 가입 보너스 토큰
    });

    // 로그인 처리
    const { password: _, ...result } = newUser.toObject();
    return this.login(result);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // 사용자 조회
    const user = await this.usersService.findById(userId);
    
    // 현재 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }
    
    // 새 비밀번호 유효성 검사
    if (newPassword.length < 6) {
      throw new BadRequestException('비밀번호는 최소 6자 이상이어야 합니다.');
    }
    
    // 비밀번호 해싱 및 업데이트
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
} 