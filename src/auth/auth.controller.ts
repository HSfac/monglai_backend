import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, Get, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PassVerificationService } from './services/pass-verification.service';
import { UsersService } from '../users/users.service';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private passVerificationService: PassVerificationService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() loginDto: { email: string; password: string }) {
    if (!loginDto.email || !loginDto.password) {
      throw new BadRequestException('이메일과 비밀번호를 모두 입력해주세요.');
    }

    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new BadRequestException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return this.authService.login(user);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '관리자 로그인' })
  @ApiResponse({ status: 200, description: '관리자 로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패 또는 관리자 권한 없음' })
  async adminLogin(@Body() loginDto: { email: string; password: string }) {
    if (!loginDto.email || !loginDto.password) {
      throw new BadRequestException('이메일과 비밀번호를 모두 입력해주세요.');
    }

    return this.authService.adminLogin(loginDto.email, loginDto.password);
  }

  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async register(@Body() registerDto: { email: string; password: string; username: string }) {
    if (!registerDto.email || !registerDto.password || !registerDto.username) {
      throw new BadRequestException('이메일, 비밀번호, 사용자명을 모두 입력해주세요.');
    }
    
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.username,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: '비밀번호 변경' })
  @ApiResponse({ status: 200, description: '비밀번호 변경 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async changePassword(
    @Request() req,
    @Body() passwordDto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.userId,
      passwordDto.currentPassword,
      passwordDto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiResponse({ status: 200, description: '프로필 조회 성공' })
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: '구글 로그인' })
  googleAuth() {
    // 구글 인증 리다이렉트
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: '구글 로그인 콜백' })
  async googleAuthCallback(@Request() req, @Res() res: Response) {
    const { email, username, provider, providerId, profileImage } = req.user;
    const result = await this.authService.socialLogin(email, username, provider, providerId, profileImage);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?access_token=${result.access_token}`);
  }

  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  @ApiOperation({ summary: '카카오 로그인' })
  kakaoAuth() {
    // 카카오 인증 리다이렉트
  }

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  @ApiOperation({ summary: '카카오 로그인 콜백' })
  async kakaoAuthCallback(@Request() req, @Res() res: Response) {
    const { email, username, provider, providerId, profileImage } = req.user;
    const result = await this.authService.socialLogin(email, username, provider, providerId, profileImage);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?access_token=${result.access_token}`);
  }

  @Post('password-reset/request')
  @ApiOperation({ summary: '비밀번호 재설정 요청' })
  @ApiResponse({ status: 200, description: '재설정 이메일 발송 성공' })
  async requestPasswordReset(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  @ApiOperation({ summary: '비밀번호 재설정 확인' })
  @ApiResponse({ status: 200, description: '비밀번호 재설정 성공' })
  async resetPassword(
    @Body() body: { email: string; token: string; newPassword: string }
  ) {
    return this.authService.resetPassword(body.email, body.token, body.newPassword);
  }

  // ==================== 성인인증 (NHN KCP) API ====================

  @Get('adult-verification/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '성인인증 상태 확인' })
  @ApiResponse({ status: 200, description: '인증 상태 조회 성공' })
  async getAdultVerificationStatus(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      isAdultVerified: user.isAdultVerified,
      adultVerifiedAt: user.adultVerifiedAt,
      kcpConfigured: this.passVerificationService.isConfigured(),
    };
  }

  @Post('adult-verification/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'KCP 본인인증 초기화' })
  @ApiResponse({ status: 200, description: '인증 초기화 성공' })
  async initAdultVerification(@Request() req) {
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:5001';
    const requestNo = this.passVerificationService.generateRequestNo();

    const result = await this.passVerificationService.initializeVerification({
      requestNo,
      returnUrl: `${backendUrl}/auth/adult-verification/callback`,
    });

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      requestNo,
      formData: result.formData,
      certUrl: result.certUrl,
      userId: req.user.userId,
    };
  }

  @Get('adult-verification/popup')
  @ApiOperation({ summary: 'KCP 인증 팝업 페이지' })
  async getVerificationPopup(
    @Res() res: Response,
    @Request() req,
  ) {
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:5001';
    const requestNo = this.passVerificationService.generateRequestNo();

    const result = await this.passVerificationService.initializeVerification({
      requestNo,
      returnUrl: `${backendUrl}/auth/adult-verification/callback`,
    });

    if (!result.success) {
      res.status(400).send(`<html><body><h1>오류</h1><p>${result.error}</p></body></html>`);
      return;
    }

    const html = this.passVerificationService.generatePopupForm(
      result.formData!,
      result.certUrl!
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('adult-verification/callback')
  @ApiOperation({ summary: 'KCP 본인인증 콜백' })
  @ApiResponse({ status: 200, description: '인증 완료' })
  async adultVerificationCallback(
    @Body() body: {
      enc_cert_data?: string;
      dn_hash?: string;
      ordr_idxx?: string;
      userId?: string;
    },
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    try {
      // KCP 콜백 데이터 처리
      if (body.enc_cert_data && body.dn_hash && body.ordr_idxx) {
        const result = await this.passVerificationService.processVerificationResult({
          enc_cert_data: body.enc_cert_data,
          dn_hash: body.dn_hash,
          ordr_idxx: body.ordr_idxx,
        });

        if (!result.success) {
          // 에러 페이지로 리다이렉트
          res.redirect(`${frontendUrl}/profile?verify=error&message=${encodeURIComponent(result.error || '인증 실패')}`);
          return;
        }

        // CI 중복 확인 및 사용자 정보 업데이트는 별도 API로 처리
        // 여기서는 결과만 프론트엔드로 전달
        const callbackHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>인증 완료</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'KCP_CERT_RESULT',
        success: true,
        data: {
          ci: '${result.ci}',
          name: '${result.name}',
          birthDate: '${result.birthDate}',
          ordr_idxx: '${body.ordr_idxx}'
        }
      }, '*');
      window.close();
    } else {
      window.location.href = '${frontendUrl}/profile?verify=success';
    }
  </script>
</body>
</html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(callbackHtml);
        return;
      }

      // 잘못된 요청
      res.redirect(`${frontendUrl}/profile?verify=error&message=${encodeURIComponent('잘못된 요청입니다.')}`);
    } catch (error: any) {
      res.redirect(`${frontendUrl}/profile?verify=error&message=${encodeURIComponent(error.message || '인증 처리 중 오류가 발생했습니다.')}`);
    }
  }

  @Post('adult-verification/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '본인인증 완료 처리' })
  @ApiResponse({ status: 200, description: '인증 정보 저장 성공' })
  async completeAdultVerification(
    @Request() req,
    @Body() body: {
      ci: string;
      name: string;
      birthDate: string;
    }
  ) {
    // CI 중복 확인
    if (body.ci) {
      const existingUser = await this.usersService.findByCI(body.ci);
      if (existingUser && (existingUser as any)._id.toString() !== req.user.userId) {
        throw new BadRequestException('이미 다른 계정에서 인증된 정보입니다.');
      }
    }

    // 인증 정보 저장
    await this.usersService.updateAdultVerification(req.user.userId, {
      isAdultVerified: true,
      adultVerifiedAt: new Date(),
      verificationCI: body.ci || '',
      verificationName: body.name || '',
      verificationBirthDate: body.birthDate || '',
    });

    return {
      success: true,
      message: '성인인증이 완료되었습니다.',
    };
  }
} 