'use client';

/**
 * 비밀번호 재설정 — 이메일 입력 단계
 * Supabase 가 등록된 이메일로 매직 링크를 발송한다.
 * 링크의 도착 페이지는 /reset-password/confirm.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth';

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return '알 수 없는 오류';
};

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('이메일을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error: unknown) {
      toast.error('재설정 메일 발송 실패', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-9 w-9" style={{ color: '#971B2F' }} />
            <span className="text-2xl font-bold text-gray-900">InBody GBS</span>
          </div>
          <p className="text-sm text-gray-600">비밀번호 재설정</p>
        </div>

        <Card>
          {sent ? (
            <CardContent className="py-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">재설정 메일을 보냈습니다</p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-mono">{email}</span> 받은편지함을 확인해 주세요.
                  <br />
                  메일이 보이지 않으면 스팸함도 확인해 주세요.
                </p>
              </div>
              <Link href="/login" className="inline-flex items-center text-sm text-blue-600 hover:underline">
                <ArrowLeft className="h-4 w-4 mr-1" /> 로그인으로 돌아가기
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">비밀번호를 잊으셨나요?</CardTitle>
                <CardDescription className="text-xs">
                  가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-xs">이메일</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@inbody.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    재설정 메일 보내기
                  </Button>
                  <Link
                    href="/login"
                    className="flex items-center justify-center text-xs text-gray-600 hover:text-gray-900 mt-2"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" /> 로그인 화면으로
                  </Link>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-gray-500 mt-4">
          © 2026 InBody Co., Ltd.
        </p>
      </div>
    </div>
  );
}
