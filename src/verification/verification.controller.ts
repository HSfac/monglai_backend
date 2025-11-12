import { Controller, Get, Post, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('본인인증')
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 본인인증 요청 페이지
   * 프론트엔드에서 이 엔드포인트를 팝업으로 열면 NICE 인증 페이지로 이동
   */
  @Get('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '본인인증 요청 (팝업용)' })
  async requestVerification(@Req() req, @Res() res: Response) {
    try {
      // 1. NICE 인증 요청 데이터 생성
      const authRequest = await this.verificationService.generateAuthRequest();

      // 2. 요청 번호를 세션에 저장 (콜백 검증용)
      // 실제로는 Redis나 DB에 저장
      const userId = req.user.userId;

      // 3. NICE 인증 페이지로 리다이렉트할 HTML 반환
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>본인인증</title>
    <meta charset="UTF-8">
</head>
<body>
    <form name="form_chk" method="post" action="https://nice.checkplus.co.kr/CheckPlusSafeModel/checkplus.cb">
        <input type="hidden" name="m" value="checkplusService">
        <input type="hidden" name="EncodeData" value="${authRequest.encData}">
        <input type="hidden" name="TokenVersionId" value="${authRequest.tokenVersionId}">
        <input type="hidden" name="IntegrityValue" value="${authRequest.integrityValue}">
        <input type="hidden" name="userId" value="${userId}">
    </form>
    <script>
        document.form_chk.submit();
    </script>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send(`
        <script>
          alert('본인인증 요청 중 오류가 발생했습니다.');
          window.close();
        </script>
      `);
    }
  }

  /**
   * NICE 본인인증 콜백
   * NICE 서버에서 인증 결과를 POST로 전송하는 URL
   */
  @Post('callback')
  @ApiOperation({ summary: 'NICE 본인인증 콜백' })
  async handleCallback(@Body() body: any, @Res() res: Response) {
    try {
      // 1. NICE에서 전송한 암호화된 데이터 추출
      const encData = body.EncodeData;
      const userId = body.userId;

      if (!encData) {
        throw new Error('인증 데이터가 없습니다.');
      }

      // 2. 데이터 복호화 및 검증
      const authResult = await this.verificationService.verifyAuthResponse(encData);

      // 3. 만 19세 이상 확인
      const isAdult = this.verificationService.isAdult(authResult.birthDate);

      if (!isAdult) {
        // 미성년자
        return res.send(`
          <script>
            alert('만 19세 이상만 인증 가능합니다.');
            window.opener.postMessage({ success: false, error: 'underage' }, '*');
            window.close();
          </script>
        `);
      }

      // 4. 중복 인증 확인 (CI로 확인)
      const existingUser = await this.usersService.findByCI(authResult.ci);
      if (existingUser && (existingUser._id as any).toString() !== userId) {
        // 다른 계정에서 이미 인증됨
        return res.send(`
          <script>
            alert('이미 다른 계정에서 인증된 정보입니다.');
            window.opener.postMessage({ success: false, error: 'duplicate' }, '*');
            window.close();
          </script>
        `);
      }

      // 5. DB 업데이트
      await this.usersService.updateAdultVerification(userId, {
        isAdultVerified: true,
        adultVerifiedAt: new Date(),
        verificationCI: authResult.ci,
        verificationName: authResult.name,
        verificationBirthDate: authResult.birthDate,
      });

      // 6. 성공 응답
      return res.send(`
        <script>
          alert('성인 인증이 완료되었습니다.');
          window.opener.postMessage({ success: true }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('본인인증 콜백 처리 중 오류:', error);
      return res.send(`
        <script>
          alert('본인인증 처리 중 오류가 발생했습니다.');
          window.opener.postMessage({ success: false, error: 'server_error' }, '*');
          window.close();
        </script>
      `);
    }
  }

  /**
   * 테스트용 더미 인증 (개발 환경 전용)
   * 실제 배포 시 제거 필요
   */
  @Post('test-verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '테스트용 성인 인증 (개발 전용)' })
  @ApiResponse({ status: 200, description: '인증 성공' })
  async testVerify(@Req() req) {
    // 환경 변수로 개발 환경 확인
    if (process.env.NODE_ENV === 'production') {
      return { success: false, message: '프로덕션 환경에서는 사용할 수 없습니다.' };
    }

    const userId = req.user.userId;

    // 더미 데이터로 인증
    const dummyEncData = this.verificationService.generateDummyAuthData();
    const authResult = await this.verificationService.verifyAuthResponse(dummyEncData);

    // DB 업데이트
    await this.usersService.updateAdultVerification(userId, {
      isAdultVerified: true,
      adultVerifiedAt: new Date(),
      verificationCI: authResult.ci,
      verificationName: authResult.name,
      verificationBirthDate: authResult.birthDate,
    });

    return {
      success: true,
      message: '테스트 인증이 완료되었습니다.',
      data: authResult,
    };
  }

  /**
   * 인증 상태 확인
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '본인인증 상태 확인' })
  async getVerificationStatus(@Req() req) {
    const userId = req.user.userId;
    const user = await this.usersService.findById(userId);

    return {
      isAdultVerified: user.isAdultVerified,
      adultVerifiedAt: user.adultVerifiedAt,
      verificationName: user.verificationName,
    };
  }
}
