export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  speakingStyle: string;
  ageDisplay?: string;
  species?: string;
  role?: string;
  appearance?: string;
  personalityCore?: string[];
  backgroundStory?: string;
  characterLikes?: string[];
  characterDislikes?: string[];
  greeting?: string;
  scenario?: string;
  category?: string;
  temperature?: number;
  exampleDialogues?: Array<{
    user: string;
    character: string;
  }>;
}

export interface WorldData {
  name: string;
  description: string;
  setting?: string;
  rules?: string[];
}

export interface PresetData {
  title: string;
  relationshipToUser: string;
  mood: string;
  speakingTone?: string;
  scenarioIntro?: string;
  rules?: string[];
  promptOverrides?: Record<string, string>;
}

export interface SessionStateData {
  mood: string;
  relationshipLevel: number;
  scene: string;
  progressCounter?: number;
  lastSceneSummary?: string;
  activeFlags?: string[];
  currentObjective?: string;
}

export interface SystemPromptParams {
  character: CharacterData;
  world?: WorldData;
  preset?: PresetData;
  sessionState?: SessionStateData;
  memorySummaries?: string[];
  eventMemories?: string[];
  importantFacts?: string[];
  userNotes?: string[];
  mode?: 'story' | 'chat' | 'creator_debug';
}

// 플랫폼 공통 규칙
const PLATFORM_RULES = [
  '항상 캐릭터로서 응답하며, OOC(Out of Character) 발언을 하지 않습니다.',
  '대사는 자연스럽게 표현하고, 행동/묘사는 *별표* 안에 표현합니다.',
  '유저의 말을 경청하고 적절하게 반응합니다.',
  '설정된 말투, 관계, 세계관, 사건 기억, 중요 기억 사실, 기억 요약과 모순되지 않게 응답합니다.',
  '샘플 대사가 있다면 그 말맛과 호흡을 우선적으로 참고합니다.',
];

export function buildSystemPrompt(params: SystemPromptParams): string {
  const {
    character,
    world,
    preset,
    sessionState,
    memorySummaries,
    eventMemories,
    importantFacts,
    userNotes,
    mode,
  } = params;

  const sections: string[] = [];

  // 1. 역할 정의
  sections.push(buildRoleSection(character, world));

  // 2. 세계관 정보 (있을 경우)
  if (world) {
    sections.push(buildWorldSection(world));
  }

  // 3. 캐릭터 정보
  sections.push(buildCharacterSection(character));

  // 4. 페르소나 프리셋 (있을 경우)
  if (preset) {
    sections.push(buildPresetSection(preset));
  }

  // 5. 현재 세션 상태 (있을 경우)
  if (sessionState) {
    sections.push(buildStateSection(sessionState));
  }

  // 5-1. 말투/반응 예시 (있을 경우)
  if (character.exampleDialogues && character.exampleDialogues.length > 0) {
    sections.push(buildExampleDialogueSection(character.exampleDialogues));
  }

  // 6. 메모리 요약 (있을 경우)
  if (memorySummaries && memorySummaries.length > 0) {
    sections.push(buildMemorySection(memorySummaries));
  }

  // 6-1. 최근 사건 기억 (있을 경우)
  if (eventMemories && eventMemories.length > 0) {
    sections.push(buildEventMemorySection(eventMemories));
  }

  // 6-2. 중요 기억 사실 (있을 경우)
  if (importantFacts && importantFacts.length > 0) {
    sections.push(buildImportantFactsSection(importantFacts));
  }

  // 7. 유저 노트 (있을 경우)
  if (userNotes && userNotes.length > 0) {
    sections.push(buildUserNotesSection(userNotes));
  }

  // 8. 규칙
  sections.push(buildRulesSection(preset?.rules));

  // 9. 출력 형식
  sections.push(buildOutputFormatSection(mode));

  // 10. 상태 메타데이터 형식
  sections.push(buildStateMetadataSection(mode));

  return sections.join('\n\n');
}

function buildRoleSection(character: CharacterData, world?: WorldData): string {
  if (world) {
    return `## 역할
당신은 "${world.name}" 세계관에 속한 "${character.name}" 캐릭터를 연기합니다.`;
  }
  return `## 역할
당신은 "${character.name}" 캐릭터를 연기합니다.`;
}

function buildWorldSection(world: WorldData): string {
  let section = `## 세계관: ${world.name}
${world.description}`;

  if (world.setting) {
    section += `\n배경: ${world.setting}`;
  }

  if (world.rules && world.rules.length > 0) {
    section += `\n세계관 규칙:\n${world.rules.map((r) => `- ${r}`).join('\n')}`;
  }

  return section;
}

function buildCharacterSection(character: CharacterData): string {
  const lines: string[] = ['## 캐릭터 정보'];

  lines.push(`- 이름: ${character.name}`);

  if (character.ageDisplay) {
    lines.push(`- 나이: ${character.ageDisplay}`);
  }

  if (character.species) {
    lines.push(`- 종족: ${character.species}`);
  }

  if (character.role) {
    lines.push(`- 역할: ${character.role}`);
  }

  if (character.appearance) {
    lines.push(`- 외형: ${character.appearance}`);
  }

  lines.push(`- 성격: ${character.personality}`);

  if (character.personalityCore && character.personalityCore.length > 0) {
    lines.push(`- 핵심 성격: ${character.personalityCore.join(', ')}`);
  }

  lines.push(`- 말투: ${character.speakingStyle}`);

  if (character.backgroundStory) {
    lines.push(`- 배경: ${character.backgroundStory}`);
  }

  if (character.characterLikes && character.characterLikes.length > 0) {
    lines.push(`- 좋아하는 것: ${character.characterLikes.join(', ')}`);
  }

  if (character.characterDislikes && character.characterDislikes.length > 0) {
    lines.push(`- 싫어하는 것: ${character.characterDislikes.join(', ')}`);
  }

  if (character.category) {
    lines.push(`- 카테고리: ${character.category}`);
  }

  if (character.scenario) {
    lines.push(`- 시나리오: ${character.scenario}`);
  }

  if (character.greeting) {
    lines.push(`- 첫 인사 톤 예시: ${character.greeting}`);
  }

  if (typeof character.temperature === 'number') {
    lines.push(
      `- 표현 강도 가이드: ${describeTemperature(character.temperature)}`,
    );
  }

  return lines.join('\n');
}

function buildPresetSection(preset: PresetData): string {
  const lines: string[] = ['## 현재 페르소나'];

  lines.push(`- 프리셋: ${preset.title}`);
  lines.push(`- 유저와의 관계: ${preset.relationshipToUser}`);
  lines.push(`- 현재 분위기: ${preset.mood}`);

  if (preset.speakingTone) {
    lines.push(`- 말투 변형: ${preset.speakingTone}`);
  }

  if (preset.scenarioIntro) {
    lines.push(`- 상황: ${preset.scenarioIntro}`);
  }

  if (preset.promptOverrides && Object.keys(preset.promptOverrides).length > 0) {
    const overrideLines = Object.entries(preset.promptOverrides).map(
      ([key, value]) => `  - ${key}: ${value}`,
    );
    lines.push(`- 프리셋 오버라이드:\n${overrideLines.join('\n')}`);
  }

  return lines.join('\n');
}

function buildStateSection(state: SessionStateData): string {
  const lines: string[] = ['## 현재 상태'];

  lines.push(`- 현재 장면: ${state.scene || '(없음)'}`);
  lines.push(`- 현재 분위기: ${state.mood}`);
  lines.push(`- 관계 레벨: ${state.relationshipLevel}/5`);

  if (typeof state.progressCounter === 'number') {
    lines.push(`- 현재 진행도: ${state.progressCounter}/5`);
  }

  if (state.lastSceneSummary) {
    lines.push(`- 최근 상황 요약: ${state.lastSceneSummary}`);
  }

  if (state.currentObjective) {
    lines.push(`- 현재 목표: ${state.currentObjective}`);
  }

  if (state.activeFlags && state.activeFlags.length > 0) {
    lines.push(`- 활성 플래그: ${state.activeFlags.join(', ')}`);
  }

  return lines.join('\n');
}

function buildExampleDialogueSection(
  exampleDialogues: Array<{ user: string; character: string }>,
): string {
  const examples = exampleDialogues
    .filter((dialogue) => dialogue.user?.trim() && dialogue.character?.trim())
    .slice(0, 4)
    .map(
      (dialogue, index) =>
        `### 예시 ${index + 1}\n유저: ${dialogue.user}\n캐릭터: ${dialogue.character}`,
    );

  if (examples.length === 0) {
    return '';
  }

  return `## 말투/반응 예시\n${examples.join('\n\n')}`;
}

function buildMemorySection(summaries: string[]): string {
  return `## 이전 대화 요약
${summaries.map((s, i) => `[${i + 1}] ${s}`).join('\n')}`;
}

function buildEventMemorySection(eventMemories: string[]): string {
  return `## 최근 사건 기억
${eventMemories.map((memory, index) => `[${index + 1}] ${memory}`).join('\n')}`;
}

function buildImportantFactsSection(facts: string[]): string {
  return `## 중요 기억 사실
${facts.map((fact) => `- ${fact}`).join('\n')}`;
}

function buildUserNotesSection(notes: string[]): string {
  return `## 유저 설정/메모
${notes.map((n) => `- ${n}`).join('\n')}`;
}

function buildRulesSection(presetRules?: string[]): string {
  const allRules = [...PLATFORM_RULES];

  if (presetRules && presetRules.length > 0) {
    allRules.push(...presetRules);
  }

  return `## 규칙
${allRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
}

function buildOutputFormatSection(mode?: string): string {
  let format = `## 출력 형식
- 대사는 따옴표 없이 직접 표현합니다.
- 행동/묘사는 *별표* 안에 표현합니다. (예: *그녀가 미소를 짓는다.*)
- OOC(Out of Character) 발언은 하지 않습니다.`;

  if (mode === 'story') {
    format += `\n- 스토리 모드: 묘사를 풍부하게 하되, 다음 전개가 자연스럽게 이어지도록 응답합니다.`;
  } else if (mode === 'chat') {
    format += `\n- 채팅 모드: 짧고 간결한 대화체로 응답하되, 캐릭터성은 유지합니다.`;
  } else if (mode === 'creator_debug') {
    format += `\n- 디버그 모드: 응답 끝에 [DEBUG] 태그로 현재 참조 중인 정보를 표시합니다.`;
  }

  return format;
}

function buildStateMetadataSection(mode?: string): string {
  const objectiveGuide =
    mode === 'story'
      ? '다음 전개 목표를 짧은 한 문장으로 작성합니다.'
      : '필요 없으면 빈 문자열로 둡니다.';

  return `## 상태 메타데이터
응답 본문 뒤에는 반드시 아래 형식의 상태 JSON 블록을 추가합니다.

[STATE]
{"mood":"현재 분위기","scene":"짧은 장면명","relationshipLevel":0,"lastSceneSummary":"최근 흐름 한 문장","activeFlags":["핵심 플래그"],"currentObjective":"현재 목표"}
[/STATE]

- [STATE] 블록 안에는 순수 JSON만 넣습니다.
- relationshipLevel은 이번 응답 시점 기준 0~5 정수입니다.
- scene은 짧고 선명한 장면명으로 작성합니다.
- lastSceneSummary는 최근 흐름을 1문장으로 요약합니다.
- activeFlags는 약속, 비밀 공유, 별명 생성, 첫 고백 같은 오래 기억해야 할 변화만 최대 3개까지 넣고, 없으면 빈 배열로 둡니다.
- currentObjective는 ${objectiveGuide}
- 본문에는 태그 설명이나 JSON 내용을 노출하지 않습니다.`;
}

function describeTemperature(temperature: number): string {
  if (temperature <= 0.35) {
    return '차분하고 안정적인 표현을 우선합니다.';
  }

  if (temperature <= 0.7) {
    return '일관성을 유지하면서도 자연스러운 변주를 허용합니다.';
  }

  return '감정 표현과 묘사를 조금 더 풍부하게 합니다.';
}

// 예시 대사 생성용 프롬프트 추가
export function buildSuggestionPrompt(): string {
  return `

---
스토리 모드에서는 [STATE] 블록 뒤에 이어서, 유저가 선택할 수 있는 응답 예시 3개를 제안해주세요.
형식:
[SUGGESTIONS]
1. (첫 번째 선택지)
2. (두 번째 선택지)
3. (세 번째 선택지)
[/SUGGESTIONS]`;
}
