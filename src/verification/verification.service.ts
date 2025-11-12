import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class VerificationService {
  // NICE 본인인증 설정 (실제로는 .env에서 가져옴)
  private readonly siteCode = process.env.NICE_SITE_CODE || 'TEST_SITE_CODE';
  private readonly sitePassword = process.env.NICE_SITE_PASSWORD || 'TEST_PASSWORD';
  private readonly returnUrl = process.env.NICE_RETURN_URL || 'http://localhost:3000/api/verification/callback';

  /**
   * NICE 본인인증 요청 데이터 생성
   * @returns 암호화된 요청 데이터
   */
  async generateAuthRequest(): Promise<{
    encData: string;
    tokenVersionId: string;
    integrityValue: string;
  }> {
    // 1. 요청 고유 번호 생성 (타임스탬프 + 랜덤)
    const requestNo = `REQ${Date.now()}${Math.floor(Math.random() * 10000)}`;

    // 2. 요청 데이터 생성
    const authData = {
      requestno: requestNo,
      returnurl: this.returnUrl,
      sitecode: this.siteCode,
      authtype: 'M', // M: 휴대폰, X: 아이핀
      methodtype: 'get', // get 또는 post
    };

    // 3. 데이터 암호화 (실제로는 NICE에서 제공하는 암호화 모듈 사용)
    const plainData = JSON.stringify(authData);
    const encData = this.encryptData(plainData);

    // 4. 무결성 검증값 생성
    const integrityValue = this.generateIntegrityValue(encData);

    return {
      encData,
      tokenVersionId: 'v1.0',
      integrityValue,
    };
  }

  /**
   * NICE 본인인증 콜백 데이터 복호화 및 검증
   * @param encData 암호화된 응답 데이터
   * @returns 복호화된 사용자 정보
   */
  async verifyAuthResponse(encData: string): Promise<{
    name: string;
    birthDate: string;
    gender: string;
    phoneNumber: string;
    ci: string; // Connecting Information
    di: string; // Duplication Information
  }> {
    try {
      // 1. 데이터 복호화 (실제로는 NICE 복호화 모듈 사용)
      const decryptedData = this.decryptData(encData);
      const authResult = JSON.parse(decryptedData);

      // 2. 인증 성공 여부 확인
      if (authResult.resultcode !== '0000') {
        throw new BadRequestException('본인인증에 실패했습니다: ' + authResult.resultmessage);
      }

      // 3. 응답 데이터 파싱
      return {
        name: authResult.name,
        birthDate: authResult.birthdate, // YYYYMMDD
        gender: authResult.gender, // 1: 남자, 0: 여자
        phoneNumber: authResult.mobileno,
        ci: authResult.ci,
        di: authResult.di,
      };
    } catch (error) {
      throw new BadRequestException('본인인증 데이터 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 만 19세 이상 확인
   * @param birthDate YYYYMMDD 형식
   * @returns 만 19세 이상 여부
   */
  isAdult(birthDate: string): boolean {
    const today = new Date();
    const birth = new Date(
      parseInt(birthDate.substring(0, 4)),
      parseInt(birthDate.substring(4, 6)) - 1,
      parseInt(birthDate.substring(6, 8)),
    );

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age >= 19;
  }

  /**
   * 데이터 암호화 (실제로는 NICE에서 제공하는 암호화 모듈 사용)
   * 여기서는 간단한 AES 암호화로 시뮬레이션
   */
  private encryptData(plainData: string): string {
    // 실제 NICE 연동 시에는 NICE에서 제공하는 암호화 라이브러리 사용
    // 예: const nice = require('nice-checkplus-module');
    //     return nice.encrypt(plainData, this.siteCode, this.sitePassword);

    // 개발/테스트용 AES 암호화
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.sitePassword, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(plainData, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // IV와 암호화된 데이터를 함께 반환
    return iv.toString('base64') + ':' + encrypted;
  }

  /**
   * 데이터 복호화 (실제로는 NICE에서 제공하는 복호화 모듈 사용)
   */
  private decryptData(encData: string): string {
    // 실제 NICE 연동 시에는 NICE에서 제공하는 복호화 라이브러리 사용
    // 예: const nice = require('nice-checkplus-module');
    //     return nice.decrypt(encData, this.siteCode, this.sitePassword);

    // 개발/테스트용 AES 복호화
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.sitePassword, 'salt', 32);

      const parts = encData.split(':');
      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new BadRequestException('데이터 복호화 중 오류가 발생했습니다.');
    }
  }

  /**
   * 무결성 검증값 생성
   */
  private generateIntegrityValue(encData: string): string {
    return crypto
      .createHash('sha256')
      .update(encData + this.siteCode)
      .digest('hex');
  }

  /**
   * 테스트용 더미 인증 데이터 생성
   * 실제 배포 시에는 제거해야 함
   */
  generateDummyAuthData(): string {
    const dummyData = JSON.stringify({
      resultcode: '0000',
      resultmessage: 'Success',
      name: '테스트사용자',
      birthdate: '19900101', // 만 34세
      gender: '1',
      mobileno: '01012345678',
      ci: 'TEST_CI_' + Date.now(),
      di: 'TEST_DI_' + Date.now(),
    });

    return this.encryptData(dummyData);
  }
}
