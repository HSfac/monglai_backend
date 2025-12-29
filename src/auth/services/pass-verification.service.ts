import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

export interface PassVerificationResult {
  success: boolean;
  ci?: string;
  di?: string;
  name?: string;
  birthDate?: string;
  gender?: string;
  nationalInfo?: string;
  mobileNo?: string;
  mobileCo?: string;
  error?: string;
}

export interface KcpCertRequest {
  requestNo: string;
  returnUrl: string;
  errorUrl?: string;
}

@Injectable()
export class PassVerificationService {
  private readonly logger = new Logger(PassVerificationService.name);

  // NHN KCP 본인인증 설정
  private readonly siteCode: string;
  private readonly sitePw: string;
  private readonly modulePath: string;

  // KCP API URLs
  private readonly KCP_CERT_URL = 'https://cert.kcp.co.kr';
  private readonly KCP_TEST_URL = 'https://testcert.kcp.co.kr';

  constructor(private configService: ConfigService) {
    this.siteCode = this.configService.get<string>('KCP_SITE_CODE') || '';
    this.sitePw = this.configService.get<string>('KCP_SITE_PW') || '';
    this.modulePath = this.configService.get<string>('KCP_MODULE_PATH') || '';
  }

  /**
   * KCP 인증 설정 여부 확인
   */
  isConfigured(): boolean {
    return !!(this.siteCode && this.sitePw);
  }

  /**
   * 인증 요청 번호 생성
   */
  generateRequestNo(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    return `MONGLAI${timestamp}${random}`;
  }

  /**
   * KCP 본인인증 요청 데이터 생성
   */
  async initializeVerification(requestData: KcpCertRequest): Promise<{
    success: boolean;
    formData?: Record<string, string>;
    certUrl?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'KCP 본인인증이 설정되지 않았습니다. 관리자에게 문의하세요.',
      };
    }

    try {
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      const certUrl = isProduction ? this.KCP_CERT_URL : this.KCP_TEST_URL;

      // 요청 데이터 준비
      const ordr_idxx = requestData.requestNo;
      const req_tx = 'cert';
      const cert_method = '01'; // 01: 휴대폰 인증
      const web_siteid = this.siteCode;

      // KCP 인증 요청에 필요한 폼 데이터
      const formData: Record<string, string> = {
        site_cd: this.siteCode,
        ordr_idxx: ordr_idxx,
        req_tx: req_tx,
        cert_method: cert_method,
        web_siteid: web_siteid,
        Ret_URL: requestData.returnUrl,
        cert_otp_use: 'Y',
        cert_enc_use: 'Y',
        // 팝업 설정
        up_hash: this.generateHash(ordr_idxx),
      };

      this.logger.log(`KCP 인증 요청 초기화: ${ordr_idxx}`);

      return {
        success: true,
        formData,
        certUrl: `${certUrl}/kcp_cert/cert_view.jsp`,
      };
    } catch (error: any) {
      this.logger.error(`KCP 인증 초기화 실패: ${error.message}`);
      return {
        success: false,
        error: error.message || '인증 초기화에 실패했습니다.',
      };
    }
  }

  /**
   * 해시 생성 (무결성 검증용)
   */
  private generateHash(ordrIdxx: string): string {
    const data = `${this.siteCode}${ordrIdxx}${this.sitePw}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * KCP 인증 결과 복호화 및 처리
   */
  async processVerificationResult(encryptedData: {
    enc_cert_data: string;
    dn_hash: string;
    ordr_idxx: string;
  }): Promise<PassVerificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'KCP 본인인증이 설정되지 않았습니다.',
      };
    }

    try {
      // 해시 검증
      const expectedHash = this.generateHash(encryptedData.ordr_idxx);
      if (encryptedData.dn_hash !== expectedHash) {
        return {
          success: false,
          error: '데이터 무결성 검증에 실패했습니다.',
        };
      }

      // 암호화된 데이터 복호화
      const decryptedData = this.decryptCertData(encryptedData.enc_cert_data);

      if (!decryptedData) {
        return {
          success: false,
          error: '인증 데이터 복호화에 실패했습니다.',
        };
      }

      // 결과 코드 확인
      if (decryptedData.res_cd !== '0000') {
        return {
          success: false,
          error: decryptedData.res_msg || '인증에 실패했습니다.',
        };
      }

      // 생년월일로 성인 여부 확인
      const birthDate = decryptedData.birth_day;
      if (!this.checkIsAdult(birthDate)) {
        return {
          success: false,
          error: '만 19세 이상만 이용 가능합니다.',
        };
      }

      this.logger.log(`KCP 인증 성공: ${decryptedData.user_name}`);

      return {
        success: true,
        ci: decryptedData.ci,
        di: decryptedData.di,
        name: decryptedData.user_name,
        birthDate: birthDate,
        gender: decryptedData.sex_code, // 1: 남, 2: 여
        mobileNo: decryptedData.phone_no,
        mobileCo: decryptedData.comm_id,
      };
    } catch (error: any) {
      this.logger.error(`KCP 인증 결과 처리 실패: ${error.message}`);
      return {
        success: false,
        error: error.message || '인증 결과 처리에 실패했습니다.',
      };
    }
  }

  /**
   * 암호화된 인증 데이터 복호화
   */
  private decryptCertData(encData: string): any {
    try {
      // AES-256 복호화
      const key = crypto.createHash('sha256').update(this.sitePw).digest();
      const iv = Buffer.alloc(16, 0);

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // URL 디코딩 및 파싱
      const params = new URLSearchParams(decrypted);
      const result: Record<string, string> = {};

      params.forEach((value, key) => {
        result[key] = value;
      });

      return result;
    } catch (error) {
      this.logger.error('복호화 실패:', error);
      return null;
    }
  }

  /**
   * 만 19세 이상인지 확인
   */
  checkIsAdult(birthDate: string): boolean {
    if (!birthDate || birthDate.length !== 8) {
      return false;
    }

    const year = parseInt(birthDate.substring(0, 4));
    const month = parseInt(birthDate.substring(4, 6));
    const day = parseInt(birthDate.substring(6, 8));

    const birth = new Date(year, month - 1, day);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age >= 19;
  }

  /**
   * 팝업용 HTML 폼 생성
   */
  generatePopupForm(formData: Record<string, string>, certUrl: string): string {
    const inputFields = Object.entries(formData)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>본인인증</title>
</head>
<body>
  <form id="kcpForm" method="post" action="${certUrl}">
    ${inputFields}
  </form>
  <script>
    document.getElementById('kcpForm').submit();
  </script>
</body>
</html>
    `.trim();
  }
}
