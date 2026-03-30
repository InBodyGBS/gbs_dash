/**
 * Gemini AI를 활용한 자연어 이슈 파싱
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Subsidiary } from '@/lib/supabase/types';
import type { IssueCategory } from '@/lib/types/issue';
import { ISSUE_CATEGORIES_ACTIVE } from '@/lib/constants/issue-categories';

interface ParsedIssue {
  title: string;
  category: IssueCategory;
  entity: string; // 법인 코드 또는 이름
  description: string;
}

/**
 * AI 프롬프트 템플릿
 */
function createPrompt(userInput: string, subsidiaries: Subsidiary[]): string {
  const subsidiaryList = subsidiaries
    .map((s) => `- ${s.code}: ${s.name}`)
    .join('\n');

  return `
당신은 회계 이슈를 분석하는 전문가입니다.
사용자가 입력한 텍스트를 분석하여 구조화된 이슈 데이터를 추출해주세요.

# 입력
${userInput}

# 출력 형식 (반드시 JSON만 출력)
{
  "title": "이슈 제목 (간결하게, 50자 이내)",
  "category": "카테고리 (아래 목록 중 하나)",
  "entity": "법인 코드 (아래 목록 중 하나)",
  "description": "상세 설명 (입력 내용 기반)"
}

# 카테고리 목록
${ISSUE_CATEGORIES_ACTIVE.map((cat) => `- ${cat}`).join('\n')}

# 법인 목록
${subsidiaryList}

# 규칙
1. 출력은 반드시 JSON 형식만 (다른 텍스트 없이)
2. 법인명이 명확하지 않으면 "HQ" 선택
3. 카테고리가 불명확하면 "Others" 선택
4. 제목은 핵심만 간결하게
5. 설명은 입력 내용을 명확하게 정리

JSON 응답:
`.trim();
}

/**
 * Gemini API를 사용하여 자연어 이슈 파싱
 */
export async function parseIssueWithAI(
  userInput: string,
  subsidiaries: Subsidiary[]
): Promise<ParsedIssue | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    // Gemini 모델 초기화
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // 프롬프트 생성
    const prompt = createPrompt(userInput, subsidiaries);

    // AI 호출
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱 (마크다운 코드 블록 제거)
    const jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed: ParsedIssue = JSON.parse(jsonText);

    // 유효성 검사
    if (!parsed.title || !parsed.category || !parsed.entity || !parsed.description) {
      throw new Error('Invalid parsed data');
    }

    return parsed;
  } catch (error) {
    console.error('❌ AI 파싱 실패:', error);
    return null;
  }
}

/**
 * 법인 코드/이름으로 Subsidiary ID 찾기
 */
export function findSubsidiaryId(
  entityCodeOrName: string,
  subsidiaries: Subsidiary[]
): string | null {
  const normalized = entityCodeOrName.toLowerCase().trim();

  // 코드로 검색
  const byCode = subsidiaries.find(
    (s) => s.code.toLowerCase() === normalized
  );
  if (byCode) return byCode.id;

  // 이름으로 검색 (부분 일치)
  const byName = subsidiaries.find((s) =>
    s.name.toLowerCase().includes(normalized)
  );
  if (byName) return byName.id;

  // HQ 기본값
  const hq = subsidiaries.find((s) => s.code === 'HQ');
  return hq?.id || null;
}

