import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCD7AREeCCiVK4KYWn9NMf99W0oOXTnk-8';
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ 모델 조회 실패:', error);
      return NextResponse.json(
        { error: '모델 조회 실패', details: error },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('✅ 사용 가능한 모델:', data.models?.length || 0, '개');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 에러:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

