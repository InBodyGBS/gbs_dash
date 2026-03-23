import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Validate Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: GEMINI_API_KEY is not set' },
      { status: 500 }
    );
  }

  // Validate session
  const supabase = createServerClient();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('모델 조회 실패:', response.status);
      return NextResponse.json(
        { error: '모델 조회 실패', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('모델 조회 에러:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
