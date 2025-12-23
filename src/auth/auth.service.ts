import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { EmailService } from './services/email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
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

    // 환영 이메일 발송 (비동기 처리)
    this.emailService.sendWelcomeEmail(email, username).catch(err => {
      console.error('Failed to send welcome email:', err);
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

  async socialLogin(
    email: string,
    username: string,
    provider: string,
    providerId: string,
    profileImage?: string
  ) {
    // 기존 소셜 계정 확인
    let user = await this.usersService.findByProviderId(provider, providerId);

    if (!user) {
      // 이메일로 기존 계정 확인
      user = await this.usersService.findByEmail(email);

      if (user) {
        // 기존 계정에 소셜 연동
        user = await this.usersService.linkSocialProvider(String(user._id), provider, providerId);
      } else {
        // 새 소셜 계정 생성
        user = await this.usersService.createSocialUser(
          email,
          username,
          provider,
          providerId,
          profileImage
        );
      }
    }

    // 로그인 처리
    const { password: _, ...result } = user.toObject();
    return this.login(result);
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // 보안을 위해 성공 메시지 반환 (이메일 존재 여부 노출 방지)
      return { message: '비밀번호 재설정 이메일을 발송했습니다.' };
    }

    // 재설정 토큰 생성 (6자리 숫자)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // 토큰과 만료 시간 저장 (30분)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    // 이메일 발송 (비동기 처리)
    this.emailService.sendPasswordResetEmail(email, resetToken).catch(err => {
      console.error('Failed to send password reset email:', err);
    });

    return { message: '비밀번호 재설정 이메일을 발송했습니다.' };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException('유효하지 않은 재설정 요청입니다.');
    }

    // 토큰 만료 확인
    if (user.passwordResetExpires < new Date()) {
      throw new BadRequestException('재설정 토큰이 만료되었습니다.');
    }

    // 토큰 검증
    const isTokenValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!isTokenValid) {
      throw new BadRequestException('잘못된 재설정 토큰입니다.');
    }

    // 새 비밀번호 유효성 검사
    if (newPassword.length < 6) {
      throw new BadRequestException('비밀번호는 최소 6자 이상이어야 합니다.');
    }

    // 비밀번호 업데이트 및 토큰 삭제
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    (user as any).passwordResetToken = undefined;
    (user as any).passwordResetExpires = undefined;
    await user.save();

    return { message: '비밀번호가 성공적으로 재설정되었습니다.' };
  }
} 