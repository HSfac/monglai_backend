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
  lastSceneSummary?: string;
}

export interface SystemPromptParams {
  character: CharacterData;
  world?: WorldData;
  preset?: PresetData;
  sessionState?: SessionStateData;
  memorySummaries?: string[];
  userNotes?: string[];
  mode?: 'story' | 'chat' | 'creator_debug';
}

// 플랫폼 공통 규칙
const PLATFORM_RULES = [
  '항상 캐릭터로서 응답하며, OOC(Out of Character) 발언을 하지 않습니다.',
  '대사는 자연스럽게 표현하고, 행동/묘사는 *별표* 안에 표현합니다.',
  '유저의 말을 경청하고 적절하게 반응합니다.',
];

export function buildSystemPrompt(params: SystemPromptParams): string {
  const { character, world, preset, sessionState, memorySummaries, userNotes, mode } = params;

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

  // 6. 메모리 요약 (있을 경우)
  if (memorySummaries && memorySummaries.length > 0) {
    sections.push(buildMemorySection(memorySummaries));
  }

  // 7. 유저 노트 (있을 경우)
  if (userNotes && userNotes.length > 0) {
    sections.push(buildUserNotesSection(userNotes));
  }

  // 8. 규칙
  sections.push(buildRulesSection(preset?.rules));

  // 9. 출력 형식
  sections.push(buildOutputFormatSection(mode));

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
    section += `\n세계관 규칙:\n${world.rules.map(r => `- ${r}`).join('\n')}`;
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

  if (character.scenario) {
    lines.push(`- 시나리오: ${character.scenario}`);
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

  return lines.join('\n');
}

function buildStateSection(state: SessionStateData): string {
  const lines: string[] = ['## 현재 상태'];

  lines.push(`- 현재 장면: ${state.scene || '(없음)'}`);
  lines.push(`- 현재 분위기: ${state.mood}`);
  lines.push(`- 관계 레벨: ${state.relationshipLevel}/5`);

  if (state.lastSceneSummary) {
    lines.push(`- 최근 상황 요약: ${state.lastSceneSummary}`);
  }

  return lines.join('\n');
}

function buildMemorySection(summaries: string[]): string {
  return `## 이전 대화 요약
${summaries.map((s, i) => `[${i + 1}] ${s}`).join('\n')}`;
}

function buildUserNotesSection(notes: string[]): string {
  return `## 유저 설정/메모
${notes.map(n => `- ${n}`).join('\n')}`;
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
    format += `\n- 스토리 모드: 묘사를 풍부하게 하고, 긴 서사를 작성합니다.`;
  } else if (mode === 'chat') {
    format += `\n- 채팅 모드: 짧고 간결한 대화체로 응답합니다.`;
  } else if (mode === 'creator_debug') {
    format += `\n- 디버그 모드: 응답 끝에 [DEBUG] 태그로 현재 참조 중인 정보를 표시합니다.`;
  }

  return format;
}

// 예시 대사 생성용 프롬프트 추가
export function buildSuggestionPrompt(): string {
  return `

---
응답 후, 유저가 선택할 수 있는 응답 예시 3개를 제안해주세요.
형식:
[SUGGESTIONS]
1. (첫 번째 선택지)
2. (두 번째 선택지)
3. (세 번째 선택지)
[/SUGGESTIONS]`;
}
