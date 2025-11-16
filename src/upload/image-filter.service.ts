import { Injectable, BadRequestException } from '@nestjs/common';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs-node';
import * as sharp from 'sharp';
import axios from 'axios';

export interface NSFWResult {
  isNSFW: boolean;
  predictions: {
    Drawing: number;
    Hentai: number;
    Neutral: number;
    Porn: number;
    Sexy: number;
  };
  reason?: string;
}

@Injectable()
export class ImageFilterService {
  private model: nsfwjs.NSFWJS | null = null;
  private modelLoading: Promise<void> | null = null;

  /**
   * NSFWJS 모델 로드 (첫 사용 시 자동 로드)
   */
  private async loadModel(): Promise<void> {
    if (this.model) {
      return;
    }

    if (this.modelLoading) {
      await this.modelLoading;
      return;
    }

    this.modelLoading = (async () => {
      try {
        console.log('NSFW 모델 로딩 중...');
        this.model = await nsfwjs.load();
        console.log('NSFW 모델 로딩 완료');
      } catch (error) {
        console.error('NSFW 모델 로딩 실패:', error);
        throw error;
      } finally {
        this.modelLoading = null;
      }
    })();

    await this.modelLoading;
  }

  /**
   * 이미지 URL 또는 Buffer로 NSFW 체크
   * @param imageSource 이미지 URL 또는 Buffer
   * @param isAdultVerified 성인인증 여부
   * @returns NSFW 검사 결과
   */
  async checkImage(
    imageSource: string | Buffer,
    isAdultVerified: boolean = false,
  ): Promise<NSFWResult> {
    try {
      // 모델 로드
      await this.loadModel();

      // 이미지 로드
      let imageBuffer: Buffer;
      if (typeof imageSource === 'string') {
        // URL에서 이미지 다운로드
        const response = await axios.get(imageSource, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        imageBuffer = Buffer.from(response.data);
      } else {
        imageBuffer = imageSource;
      }

      // Sharp로 이미지 전처리 (224x224로 리사이즈)
      const processedImage = await sharp(imageBuffer)
        .resize(224, 224)
        .removeAlpha()
        .toBuffer();

      // TensorFlow 텐서로 변환
      const tensor = tf.node.decodeImage(processedImage, 3) as tf.Tensor3D;

      // NSFW 예측
      const predictions = await this.model!.classify(tensor);
      tensor.dispose(); // 메모리 해제

      // 예측 결과를 객체로 변환
      const result = {
        Drawing: 0,
        Hentai: 0,
        Neutral: 0,
        Porn: 0,
        Sexy: 0,
      };

      predictions.forEach((pred) => {
        result[pred.className] = pred.probability;
      });

      // NSFW 판단 로직
      const nsfwScore = result.Porn + result.Hentai;
      const sexyScore = result.Sexy;

      // 성인인증 사용자는 완화된 기준 적용
      if (isAdultVerified) {
        // 성인 사용자: 포르노/헨타이 70% 이상만 차단
        if (nsfwScore > 0.7) {
          return {
            isNSFW: true,
            predictions: result,
            reason: '과도한 성적 콘텐츠가 감지되었습니다.',
          };
        }
      } else {
        // 미성년자: 엄격한 기준 (포르노/헨타이 40% 이상 OR 섹시 60% 이상)
        if (nsfwScore > 0.4 || sexyScore > 0.6) {
          return {
            isNSFW: true,
            predictions: result,
            reason: '부적절한 이미지가 감지되었습니다. (성인 콘텐츠)',
          };
        }
      }

      return {
        isNSFW: false,
        predictions: result,
      };
    } catch (error) {
      console.error('이미지 NSFW 체크 실패:', error);
      // 에러 발생 시 안전하게 통과 (서비스 중단 방지)
      // 프로덕션에서는 로깅 후 수동 검토 플래그 설정
      return {
        isNSFW: false,
        predictions: {
          Drawing: 0,
          Hentai: 0,
          Neutral: 1,
          Porn: 0,
          Sexy: 0,
        },
        reason: '이미지 분석 실패 (수동 검토 필요)',
      };
    }
  }

  /**
   * 프로필 이미지 검증 (업로드 전 체크)
   */
  async validateProfileImage(
    imageSource: string | Buffer,
    isAdultVerified: boolean = false,
  ): Promise<void> {
    const result = await this.checkImage(imageSource, isAdultVerified);

    if (result.isNSFW) {
      throw new BadRequestException(result.reason || '부적절한 이미지입니다.');
    }
  }

  /**
   * 캐릭터 이미지 검증 (생성/수정 시)
   */
  async validateCharacterImage(
    imageSource: string | Buffer,
    isAdultContent: boolean = false,
    isAdultVerified: boolean = false,
  ): Promise<void> {
    const result = await this.checkImage(imageSource, isAdultVerified);

    // 성인 캐릭터인 경우 완화된 기준
    if (isAdultContent && isAdultVerified) {
      // 성인 캐릭터는 포르노/헨타이 80% 이상만 차단
      const nsfwScore = result.predictions.Porn + result.predictions.Hentai;
      if (nsfwScore > 0.8) {
        throw new BadRequestException('과도한 성적 콘텐츠가 감지되었습니다.');
      }
      return;
    }

    // 일반 캐릭터는 기본 기준 적용
    if (result.isNSFW) {
      throw new BadRequestException(result.reason || '부적절한 이미지입니다.');
    }
  }

  /**
   * 배치 이미지 검사 (여러 이미지 동시 체크)
   */
  async checkMultipleImages(
    imageSources: (string | Buffer)[],
    isAdultVerified: boolean = false,
  ): Promise<NSFWResult[]> {
    const results = await Promise.all(
      imageSources.map((source) => this.checkImage(source, isAdultVerified)),
    );
    return results;
  }
}
