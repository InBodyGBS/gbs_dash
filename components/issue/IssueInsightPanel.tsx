'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Issue, IssueFilters } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';

interface IssueInsightPanelProps {
  issues: Issue[];
  subsidiaries: Subsidiary[];
  filters: IssueFilters;
}

export function IssueInsightPanel({ issues, subsidiaries, filters }: IssueInsightPanelProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (issues.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issues,
          subsidiaries,
          dateRange: filters.dateRange,
          filters: {
            categories: filters.categories,
            entities: filters.entities,
            authors: filters.authors,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');

      setAnalysis(data.analysis);
      setCollapsed(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 마크다운 ## 헤더를 bold 처리하여 렌더링
  const renderAnalysis = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <p key={i} className="font-semibold text-blue-900 mt-3 mb-1">
            {line.replace('## ', '')}
          </p>
        );
      }
      if (line.trim() === '') return <br key={i} />;
      return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">AI 이슈 인사이트</h3>
          <span className="text-xs text-blue-400 bg-blue-100 px-2 py-0.5 rounded-full">
            {issues.length}건 분석 대상
          </span>
        </div>
        <div className="flex items-center gap-2">
          {analysis && !loading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              className="text-blue-500 hover:text-blue-700 h-7 px-2"
              title="재분석"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
          {analysis && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="text-blue-500 hover:text-blue-700 h-7 px-2"
            >
              {collapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={loading || issues.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                분석하기
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 안내 문구 (분석 전) */}
      {!analysis && !loading && !error && (
        <p className="mt-2 text-sm text-blue-400">
          현재 필터 조건의 이슈를 Gemini AI가 분석하여 재무 관점의 인사이트를 제공합니다.
        </p>
      )}

      {/* 에러 */}
      {error && (
        <p className="mt-2 text-sm text-red-500">
          ⚠️ {error}
        </p>
      )}

      {/* 분석 결과 */}
      {analysis && !collapsed && (
        <div className="mt-3 border-t border-blue-200 pt-3 space-y-0.5 max-h-96 overflow-y-auto pr-1">
          {renderAnalysis(analysis)}
        </div>
      )}

      {/* 접혔을 때 요약 표시 */}
      {analysis && collapsed && (
        <p className="mt-2 text-xs text-blue-400">분석 결과가 있습니다. 펼치기 버튼을 클릭하세요.</p>
      )}
    </div>
  );
}
