import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// OpenAI Moderation API 카테고리 타입
interface ModerationCategories {
  sexual: boolean;
  hate: boolean;
  harassment: boolean;
  'self-harm': boolean;
  'sexual/minors': boolean;
  'hate/threatening': boolean;
  'violence/graphic': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  'harassment/threatening': boolean;
  violence: boolean;
}

interface ModerationResult {
  isInappropriate: boolean;
  reason?: string;
  categories?: Partial<ModerationCategories>;
  filteredText?: string;
  source?: 'keyword' | 'openai' | 'pattern';
}

@Injectable()
export class ContentFilterService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    // OpenAI 클라이언트 초기화
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

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
   * 텍스트 정규화 (우회 기법 방지)
   * Leetspeak, 공백, 특수문자 제거
   */
  private normalizeText(text: string): string {
    return text
      // Unicode 정규화 (동형 문자 방지)
      .normalize('NFKC')
      // Leetspeak 정규화
      .replace(/[4@]/gi, 'a')
      .replace(/[3]/g, 'e')
      .replace(/[1!]/gi, 'i')
      .replace(/[0]/g, 'o')
      .replace(/[$5]/g, 's')
      .replace(/[7]/g, 't')
      // 과도한 공백 제거
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * OpenAI Moderation API로 콘텐츠 검열 (무료)
   * 95% 정확도, 평균 47ms 응답
   */
  private async moderateWithOpenAI(text: string): Promise<ModerationResult> {
    try {
      const moderation = await this.openai.moderations.create({
        input: text,
      });

      const result = moderation.results[0];

      if (result.flagged) {
        // 차단된 카테고리 추출
        const flaggedCategories = Object.entries(result.categories)
          .filter(([_, value]) => value)
          .map(([key]) => key);

        return {
          isInappropriate: true,
          reason: `부적절한 내용이 감지되었습니다 (${flaggedCategories.join(', ')})`,
          categories: result.categories,
          source: 'openai',
        };
      }

      return { isInappropriate: false, source: 'openai' };
    } catch (error) {
      console.error('OpenAI Moderation API 오류:', error);
      // API 실패 시 키워드 필터로 폴백
      return { isInappropriate: false, source: 'openai' };
    }
  }

  /**
   * 다층 방어 시스템: 키워드 + AI + 성인인증 체크
   * @param text 검사할 텍스트
   * @param isAdultVerified 성인인증 여부
   */
  async checkContent(
    text: string,
    isAdultVerified: boolean = false,
  ): Promise<ModerationResult> {
    // 빈 텍스트 체크
    if (!text || text.trim().length === 0) {
      return { isInappropriate: false };
    }

    // 텍스트 정규화 (우회 기법 방지)
    const normalizedText = this.normalizeText(text);

    // === 1단계: 불법 콘텐츠 체크 (모든 사용자에게 적용) ===
    for (const pattern of this.illegalPatterns) {
      if (pattern.test(normalizedText) || pattern.test(text)) {
        return {
          isInappropriate: true,
          reason: '불법적인 내용이 감지되어 차단되었습니다.',
          source: 'pattern',
        };
      }
    }

    // === 2단계: 개인정보 보호 체크 ===
    const personalInfoCheck = this.detectPersonalInfo(text);
    if (personalInfoCheck.hasPersonalInfo) {
      return {
        isInappropriate: true,
        reason: `개인정보가 포함되어 있습니다 (${personalInfoCheck.types.join(', ')})`,
        source: 'pattern',
      };
    }

    // === 3단계: 스팸 체크 ===
    if (this.isSpam(text)) {
      return {
        isInappropriate: true,
        reason: '스팸으로 감지되었습니다.',
        source: 'keyword',
      };
    }

    // === 4단계: OpenAI Moderation API (무료, 문맥 이해) ===
    const aiCheck = await this.moderateWithOpenAI(text);

    if (aiCheck.isInappropriate && aiCheck.categories) {
      // 성인인증 사용자 처리
      if (isAdultVerified) {
        // 성인은 성적 콘텐츠 허용, 나머지는 차단
        const { sexual, 'sexual/minors': sexualMinors, ...otherCategories } = aiCheck.categories;

        // 미성년자 관련 콘텐츠는 무조건 차단
        if (sexualMinors) {
          return {
            isInappropriate: true,
            reason: '불법적인 내용이 감지되었습니다.',
            source: 'openai',
          };
        }

        // 나머지 위험 카테고리 체크 (폭력, 혐오, 자해 등)
        const hasOtherViolations = Object.values(otherCategories).some(v => v === true);
        if (hasOtherViolations) {
          return {
            isInappropriate: true,
            reason: aiCheck.reason,
            categories: aiCheck.categories,
            source: 'openai',
          };
        }

        // 성인 콘텐츠만 있는 경우 허용
        return { isInappropriate: false, source: 'openai' };
      } else {
        // 미성년자는 모든 부적절한 콘텐츠 차단
        return aiCheck;
      }
    }

    // === 5단계: 키워드 필터 (미성년자만) ===
    if (!isAdultVerified) {
      // 금지 단어 체크
      for (const word of this.bannedWords) {
        if (normalizedText.toLowerCase().includes(word.toLowerCase())) {
          return {
            isInappropriate: true,
            reason: '부적절한 단어가 포함되어 있습니다.',
            filteredText: this.maskBannedWords(text),
            source: 'keyword',
          };
        }
      }

      // 의심스러운 패턴 체크
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(normalizedText) || pattern.test(text)) {
          return {
            isInappropriate: true,
            reason: '부적절한 내용이 감지되었습니다.',
            filteredText: this.maskSuspiciousContent(text),
            source: 'pattern',
          };
        }
      }
    }

    // 모든 검사 통과
    return { isInappropriate: false };
  }

  /**
   * AI 응답 체크 (AI가 부적절한 내용을 생성했는지)
   */
  async checkAIResponse(
    response: string,
    isAdultVerified: boolean = false,
  ): Promise<ModerationResult> {
    // AI 응답도 같은 기준으로 체크
    return this.checkContent(response, isAdultVerified);
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
