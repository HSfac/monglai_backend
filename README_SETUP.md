# 몽글AI 백엔드 설정 가이드

## 1. 환경 설정

### 1-1. .env 파일 생성
```bash
cp .env.example .env
```

### 1-2. 필수 환경변수 설정

#### MongoDB 설정
- 로컬: `mongodb://localhost:27017/monglai`
- MongoDB Atlas: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 에서 클러스터 생성 후 연결 문자열 사용

#### AI API 키
- **OpenAI**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Claude (Anthropic)**: [https://console.anthropic.com/](https://console.anthropic.com/)
- **Mistral AI**: [https://console.mistral.ai/](https://console.mistral.ai/)

#### Toss Payments
- [Toss Payments 개발자센터](https://developers.tosspayments.com/)에서 API 키 발급
- 테스트 키와 실제 키 구분하여 사용

#### AWS S3 (이미지 업로드)
- AWS IAM에서 S3 접근 권한이 있는 사용자 생성
- Access Key ID와 Secret Access Key 발급
- S3 버킷 생성

#### 관리자 토큰
- `.env` 파일의 `ADMIN_TOKEN`을 안전한 값으로 변경
- 관리자 대시보드 API 호출 시 `x-admin-token` 헤더에 이 값 사용

## 2. 설치 및 실행

### 설치
```bash
npm install
```

### 개발 모드 실행
```bash
npm run start:dev
```

### 빌드
```bash
npm run build
```

### 프로덕션 실행
```bash
npm run start:prod
```

## 3. API 문서

서버 실행 후 Swagger 문서 확인:
```
http://localhost:3000/api
```

## 4. 관리자 대시보드 사용법

### 관리자 API 호출 예시
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  http://localhost:3000/admin/dashboard/stats
```

### 주요 관리자 API
- `GET /admin/dashboard/stats` - 대시보드 통계
- `GET /admin/users` - 사용자 목록
- `GET /admin/characters` - 캐릭터 목록
- `GET /admin/payments` - 결제 내역
- `GET /admin/revenue/stats` - 매출 통계
- `PUT /admin/users/:id/block` - 사용자 차단/해제
- `PUT /admin/characters/:id/verify` - 캐릭터 검증

## 5. 주요 기능

### 결제 시스템
- **토큰 구매**: 단건 결제 (Toss Payments 일반 결제)
- **구독**: 빌링키 기반 자동 결제 (월간/연간)

### 콘텐츠 필터링
- 미성년자: 엄격한 필터링
- 성인인증 사용자: 불법 콘텐츠만 차단

### 크리에이터 수익
- LEVEL3 크리에이터: 토큰 비용의 10% 수익 배분
- 월간 Top 10: 보너스 토큰 지급

### 알림 시스템
- 토큰 충전, 구독 시작, 레벨업 등 자동 알림

## 6. 배포

### AWS EC2 배포
1. Ubuntu 서버 생성
2. Node.js 설치
3. PM2로 프로세스 관리
```bash
pm2 start dist/main.js --name monglai-api
pm2 startup
pm2 save
```

### MongoDB Atlas 사용
- 프로덕션에서는 MongoDB Atlas 사용 권장
- IP 화이트리스트 설정 필요

## 7. 보안 주의사항
- `.env` 파일은 절대 Git에 커밋하지 말 것
- `ADMIN_TOKEN`은 복잡하게 설정
- 프로덕션 환경에서는 `JWT_SECRET` 변경 필수
- HTTPS 사용 필수 (Let's Encrypt 등)
