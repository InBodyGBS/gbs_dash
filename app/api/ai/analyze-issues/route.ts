/**
 * 이슈 목록 AI 요약/인사이트 API
 * - 현재 필터 조건에 맞는 이슈들을 분석하여 재무 담당자 관점의 인사이트 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface IssueInput {
  title: string;
  category: string;
  status: string;
  description: string;
  response?: string;
  created_by: string;
  created_at: string;
  entity_id: string;
}

interface SubsidiaryInput {
  id: string;
  name: string;
}

interface FiltersInput {
  categories?: string[];
  entities?: string[];
  authors?: string[];
}

interface DateRangeInput {
  startDate?: string | null;
  endDate?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server configuration error: GEMINI_API_KEY is not set' },
        { status: 500 }
      );
    }

    // 인증 검증
    const supabase = createServerClient();
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { issues, subsidiaries, dateRange, filters }: {
      issues: IssueInput[];
      subsidiaries: SubsidiaryInput[];
      dateRange: DateRangeInput;
      filters: FiltersInput;
    } = await request.json();

    if (!issues || issues.length === 0) {
      return NextResponse.json(
        { error: '분석할 이슈가 없습니다' },
        { status: 400 }
      );
    }

    // 이슈 목록 텍스트 변환
    const issueList = issues
      .map((issue, i) => {
        const entityName =
          subsidiaries?.find((s) => s.id === issue.entity_id)?.name || issue.entity_id;
        return `[${i + 1}] [${issue.category}] ${issue.title}
  - 법인: ${entityName}
  - 상태: ${issue.status}
  - 작성자: ${issue.created_by}
  - 등록일: ${issue.created_at.slice(0, 10)}
  - 내용: ${issue.description}
  - 대응: ${issue.response || '미입력'}`;
      })
      .join('\n\n');

    const periodText =
      dateRange?.startDate && dateRange?.endDate
        ? `${dateRange.startDate} ~ ${dateRange.endDate}`
        : '전체 기간';

    const filterParts = [
      filters?.categories && filters.categories.length > 0
        ? `카테고리: ${filters.categories.join(', ')}`
        : null,
      filters?.entities && filters.entities.length > 0
        ? `법인: ${filters.entities.length}개 선택`
        : null,
      filters?.authors && filters.authors.length > 0
        ? `작성자: ${filters.authors.join(', ')}`
        : null,
    ].filter(Boolean);
    const filterText = filterParts.length > 0 ? filterParts.join(' | ') : '전체';

    const prompt = `
당신은 해외법인 재무결산을 담당하는 글로벌사업지원팀의 주간 이슈 보고서를 작성하는 담당자입니다.
아래는 [${periodText}] 기간 동안 등록된 이슈 ${issues.length}건입니다. (적용 필터: ${filterText})

# 이슈 목록
${issueList}

# 요청 사항
다음 3개 섹션으로 주간 보고서 형식에 맞게 작성해주세요.

## 이슈 현황 요약
금주 등록된 이슈 전반을 2~3문장으로 간결하게 요약합니다.
전체 건수, 완료 건수, 미완료 건수 등 수치를 포함하여 작성합니다.

## 주요 이슈 (중요도 순)
재무 영향도가 높은 순으로 이슈를 아래 형식으로 작성합니다.

[법인명] 이슈 제목
- 이슈 배경 및 맥락을 1~2문장으로 설명
  1. 세부 항목명: 원인 및 현황 설명 – 향후 조치 또는 처리 예정 내용
  2. 세부 항목명: 원인 및 현황 설명 – 향후 조치 또는 처리 예정 내용
  ※ 담당자 대응 방식이나 추가 관찰 사항이 있으면 마지막에 기재

이슈에 기재된 내용(description)과 대응 내용(response)을 최대한 활용하여 구체적으로 작성합니다.
세부 항목이 없는 이슈는 배경과 현황, 조치 내용을 서술형으로 작성합니다.

## 조치 필요 사항
미완료 상태이거나 대응이 미입력된 이슈 중 즉각 조치가 필요한 항목을 구체적으로 나열합니다.

# 작성 규칙
- 한국어로 작성
- 각 섹션은 ## 헤더로 구분
- 주간보고서 스타일로 명확하게 작성
- 감정적 표현 없이 사실 중심으로 작성
- 수치(건수, 완료율 등)가 있으면 반드시 포함
- 이슈에 기재된 원문 내용을 최대한 반영하여 구체적으로 서술
- 글자 수 제한 없이 이슈 내용을 충분히 기술
`.trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json();
      console.error('Gemini API error:', response.status, errBody);
      if (response.status === 503) {
        throw new Error('AI 서버에 요청이 몰려 일시적으로 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
      }
      if (response.status === 429) {
        throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`Gemini API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('AI 응답이 비어 있습니다');
    }

    return NextResponse.json({ success: true, analysis: text });
  } catch (error) {
    console.error('이슈 분석 실패:', error);
    return NextResponse.json(
      { error: '이슈 분석 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
