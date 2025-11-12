import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentFilterService {
  // 부적절한 단어 목록 (미성년자용 - 엄격)
  private readonly bannedWords = [
    '욕설1',
    '욕설2',
    '혐오',
    '폭력',
    '성적',
    // 실제 배포 시에는 더 포괄적인 목록 필요
  ];

  // 의심스러운 패턴 (미성년자용)
  private readonly suspiciousPatterns = [
    /\b(폭력|살인|자해)\b/gi,
    /\b(성적|음란|19금)\b/gi,
    /\b(혐오|차별|비하)\b/gi,
    /\b(불법|마약|범죄)\b/gi,
  ];

  // 불법 콘텐츠 패턴 (성인인증 사용자에게도 적용)
  private readonly illegalPatterns = [
    /\b(마약|대마초|필로폰|코카인|헤로인)\b/gi,
    /\b(폭발물|총기|무기제조)\b/gi,
    /\b(아동|미성년자).*(성적|음란|포르노)\b/gi,
    /\b(살인|자살)\s*(방법|하는법)\b/gi,
    /\b(개인정보|주민번호)\s*(판매|유출)\b/gi,
  ];

  /**
   * 텍스트가 부적절한지 확인
   * @param text 검사할 텍스트
   * @param isAdultVerified 성인인증 여부
   * @returns { isInappropriate: boolean, reason: string }
   */
  checkContent(
    text: string,
    isAdultVerified: boolean = false,
  ): { isInappropriate: boolean; reason?: string; filteredText?: string } {
    // 성인인증 사용자는 완화된 필터링 적용
    if (isAdultVerified) {
      return this.checkAdultContent(text);
    }

    // 미성년자 - 엄격한 필터링
    // 1. 금지 단어 체크
    for (const word of this.bannedWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        return {
          isInappropriate: true,
          reason: '부적절한 단어가 포함되어 있습니다.',
          filteredText: this.maskBannedWords(text),
        };
      }
    }

    // 2. 의심스러운 패턴 체크
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          isInappropriate: true,
          reason: '부적절한 내용이 감지되었습니다.',
          filteredText: this.maskSuspiciousContent(text),
        };
      }
    }

    // 3. 과도한 반복 패턴 체크 (스팸)
    if (this.isSpam(text)) {
      return {
        isInappropriate: true,
        reason: '스팸으로 감지되었습니다.',
      };
    }

    return { isInappropriate: false };
  }

  /**
   * 성인인증 사용자용 필터링 (불법 콘텐츠만 차단)
   */
  private checkAdultContent(text: string): { isInappropriate: boolean; reason?: string } {
    // 1. 불법 콘텐츠 체크
    for (const pattern of this.illegalPatterns) {
      if (pattern.test(text)) {
        return {
          isInappropriate: true,
          reason: '불법적인 내용이 감지되었습니다.',
        };
      }
    }

    // 2. 스팸 체크는 유지
    if (this.isSpam(text)) {
      return {
        isInappropriate: true,
        reason: '스팸으로 감지되었습니다.',
      };
    }

    return { isInappropriate: false };
  }

  /**
   * 금지 단어를 마스킹 처리
   */
  private maskBannedWords(text: string): string {
    let maskedText = text;
    for (const word of this.bannedWords) {
      const regex = new RegExp(word, 'gi');
      maskedText = maskedText.replace(regex, '*'.repeat(word.length));
    }
    return maskedText;
  }

  /**
   * 의심스러운 내용 마스킹 처리
   */
  private maskSuspiciousContent(text: string): string {
    let maskedText = text;
    for (const pattern of this.suspiciousPatterns) {
      maskedText = maskedText.replace(pattern, (match) => '*'.repeat(match.length));
    }
    return maskedText;
  }

  /**
   * 스팸 체크 (같은 문자 반복, 같은 단어 반복)
   */
  private isSpam(text: string): boolean {
    // 같은 문자가 10번 이상 반복
    const charRepeatPattern = /(.)\1{9,}/;
    if (charRepeatPattern.test(text)) {
      return true;
    }

    // 같은 단어가 5번 이상 반복
    const words = text.split(/\s+/);
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 2) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        if (wordCounts.get(word)! >= 5) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * AI 응답 체크 (AI가 부적절한 내용을 생성했는지)
   */
  checkAIResponse(
    response: string,
    isAdultVerified: boolean = false,
  ): { isInappropriate: boolean; reason?: string } {
    // AI 응답도 같은 기준으로 체크
    return this.checkContent(response, isAdultVerified);
  }

  /**
   * 개인정보 패턴 감지 (전화번호, 이메일 등)
   */
  detectPersonalInfo(text: string): { hasPersonalInfo: boolean; types: string[] } {
    const patterns = {
      phone: /(\d{3}[-.]?\d{3,4}[-.]?\d{4})/g,
      email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,
      ssn: /(\d{6}[-]?\d{7})/g, // 주민등록번호 패턴
      card: /(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})/g, // 카드번호 패턴
    };

    const detectedTypes: string[] = [];

    if (patterns.phone.test(text)) detectedTypes.push('전화번호');
    if (patterns.email.test(text)) detectedTypes.push('이메일');
    if (patterns.ssn.test(text)) detectedTypes.push('주민등록번호');
    if (patterns.card.test(text)) detectedTypes.push('카드번호');

    return {
      hasPersonalInfo: detectedTypes.length > 0,
      types: detectedTypes,
    };
  }
}
