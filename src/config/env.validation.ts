import { plainToClass } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, validateSync, IsOptional } from 'class-validator';

/**
 * 환경변수 검증 클래스
 * 애플리케이션 시작 시 필수 환경변수가 설정되어 있는지 검증합니다.
 */
class EnvironmentVariables {
  // MongoDB
  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  // JWT
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION?: string;

  // AI API Keys
  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  CLAUDE_API_KEY?: string;

  @IsString()
  @IsOptional()
  XAI_API_KEY?: string; // Grok

  // AWS
  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_S3_BUCKET?: string;

  @IsString()
  @IsOptional()
  AWS_REGION?: string;

  // Toss Payments
  @IsString()
  @IsOptional()
  TOSS_PAYMENTS_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  TOSS_PAYMENTS_CLIENT_KEY?: string;

  // NICE 본인인증
  @IsString()
  @IsOptional()
  NICE_SITE_CODE?: string;

  @IsString()
  @IsOptional()
  NICE_SITE_PASSWORD?: string;

  @IsString()
  @IsOptional()
  NICE_RETURN_URL?: string;

  // Server
  @IsString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  // Frontend URL (CORS)
  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;
}

/**
 * 환경변수 검증 함수
 * @param config - process.env 객체
 * @returns 검증된 환경변수 객체
 * @throws 필수 환경변수가 없거나 유효하지 않으면 에러 발생
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(
      `❌ 환경변수 검증 실패:\n${errorMessages.join('\n')}\n\n` +
        `💡 .env 파일을 확인하거나 .env.example을 참고하세요.`
    );
  }

  return validatedConfig;
}
