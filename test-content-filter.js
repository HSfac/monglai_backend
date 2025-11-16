/**
 * 콘텐츠 필터 간단 테스트 스크립트
 *
 * 실행 방법:
 * node test-content-filter.js
 */

const testCases = [
  // ===== 정상 케이스 =====
  {
    category: '정상',
    text: '안녕하세요! 오늘 날씨가 좋네요.',
    isAdultVerified: false,
    expectedResult: 'PASS',
  },
  {
    category: '정상',
    text: 'AI와 대화하는 것이 재미있어요',
    isAdultVerified: false,
    expectedResult: 'PASS',
  },

  // ===== 미성년자 차단 케이스 =====
  {
    category: '성적 콘텐츠 (미성년자)',
    text: 'Let\'s talk about sex',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
  {
    category: '폭력 콘텐츠',
    text: 'I want to kill someone',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
  {
    category: '혐오 발언',
    text: 'I hate all people from [country]',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },

  // ===== 성인 허용 케이스 =====
  {
    category: '성적 콘텐츠 (성인)',
    text: 'Let\'s talk about romantic relationships',
    isAdultVerified: true,
    expectedResult: 'PASS',
  },

  // ===== 우회 기법 테스트 =====
  {
    category: 'Leetspeak 우회',
    text: '$3x, pr0n, h3llo',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
  {
    category: '공백 우회',
    text: 's  e  x',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },

  // ===== 불법 콘텐츠 (모든 사용자 차단) =====
  {
    category: '마약',
    text: '마약 구매 방법',
    isAdultVerified: true,
    expectedResult: 'BLOCK',
  },
  {
    category: '아동성착취물',
    text: 'child pornography',
    isAdultVerified: true,
    expectedResult: 'BLOCK',
  },

  // ===== 개인정보 =====
  {
    category: '전화번호',
    text: '제 번호는 010-1234-5678입니다',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
  {
    category: '이메일',
    text: 'test@example.com으로 연락주세요',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },

  // ===== 스팸 =====
  {
    category: '문자 반복 스팸',
    text: 'aaaaaaaaaaaaaaaa',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
  {
    category: '단어 반복 스팸',
    text: '구매 구매 구매 구매 구매',
    isAdultVerified: false,
    expectedResult: 'BLOCK',
  },
];

console.log('\n===========================================');
console.log('   몽글AI 콘텐츠 필터 테스트 시나리오');
console.log('===========================================\n');

console.log('총 테스트 케이스:', testCases.length);
console.log('');

testCases.forEach((testCase, index) => {
  const status = testCase.expectedResult === 'BLOCK' ? '❌ 차단' : '✅ 통과';
  const userType = testCase.isAdultVerified ? '성인' : '미성년자';

  console.log(`[${index + 1}] ${testCase.category}`);
  console.log(`    사용자: ${userType}`);
  console.log(`    입력: "${testCase.text}"`);
  console.log(`    예상 결과: ${status}`);
  console.log('');
});

console.log('===========================================');
console.log('   실제 테스트 실행 방법');
console.log('===========================================\n');

console.log('1. 서버 실행:');
console.log('   cd /Users/sinhuiseong/monglai/backend');
console.log('   npm run start:dev\n');

console.log('2. Swagger UI 접속:');
console.log('   http://localhost:5001/api\n');

console.log('3. 테스트 순서:');
console.log('   a) POST /auth/register - 미성년자 계정 생성');
console.log('   b) POST /auth/login - 로그인');
console.log('   c) POST /chat - 채팅방 생성');
console.log('   d) POST /chat/:id/messages - 메시지 전송 (위 테스트 케이스 입력)');
console.log('   e) 성인 계정으로 전환 후 동일 테스트 반복\n');

console.log('4. 이미지 NSFW 테스트:');
console.log('   a) POST /upload/image - NSFW 이미지 업로드 시도');
console.log('   b) 차단 메시지 확인\n');

console.log('===========================================');
console.log('   주요 체크 포인트');
console.log('===========================================\n');

console.log('✅ OpenAI Moderation API 호출 확인');
console.log('   → 콘솔에 "OpenAI Moderation API 오류" 없어야 함\n');

console.log('✅ 성인/미성년자 차등 필터링');
console.log('   → 동일 성적 콘텐츠가 미성년자는 차단, 성인은 허용\n');

console.log('✅ Leetspeak 우회 탐지');
console.log('   → "$3x" 같은 변형도 차단\n');

console.log('✅ NSFWJS 모델 로딩');
console.log('   → 첫 이미지 업로드 시 모델 다운로드 (~100MB, 1-2분 소요)\n');

console.log('===========================================');
console.log('   예상 응답 예시');
console.log('===========================================\n');

console.log('// 차단된 경우');
console.log(`{
  "statusCode": 400,
  "message": "부적절한 내용이 감지되었습니다 (sexual, violence)",
  "error": "Bad Request"
}\n`);

console.log('// 통과된 경우');
console.log(`{
  "_id": "...",
  "messages": [
    { "sender": "user", "content": "안녕하세요" },
    { "sender": "ai", "content": "안녕하세요! ..." }
  ]
}\n`);

console.log('===========================================\n');
