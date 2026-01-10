/**
 * 서버 사이드 AI 파싱 API
 * (환경 변수 접근을 위해 서버에서 실행)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ISSUE_CATEGORIES } from '@/lib/constants/issue-categories';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCD7AREeCCiVK4KYWn9NMf99W0oOXTnk-8';
    const { userInput, subsidiaries } = await request.json();

    if (!userInput || !subsidiaries) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔑 API 키 사용 중');
    console.log('📝 사용자 입력:', userInput);

    // 프롬프트 생성
    const subsidiaryList = subsidiaries
      .map((s: any) => `- ${s.code}: ${s.name}`)
      .join('\n');

    const prompt = `
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
${ISSUE_CATEGORIES.map((cat) => `- ${cat}`).join('\n')}

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

    // 직접 API 호출 (v1 사용)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API 에러:', error);
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0]?.content?.parts[0]?.text;
    
    console.log('📤 AI 응답:', text);

    // JSON 추출
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      const bracketMatch = text.match(/\{[\s\S]*\}/);
      if (bracketMatch) {
        jsonText = bracketMatch[0];
      }
    }

    const parsed = JSON.parse(jsonText);
    console.log('✅ 파싱 성공:', parsed);

    return NextResponse.json({
      success: true,
      data: parsed,
    });

  } catch (error) {
    console.error('❌ AI 파싱 실패:', error);
    return NextResponse.json(
      { error: 'AI 파싱 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

