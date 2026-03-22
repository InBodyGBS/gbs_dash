'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AuditGrid } from '@/components/audit-and-tax/AuditGrid';
import { CardNewsCard } from '@/components/audit-and-tax/CardNewsCard';
import { CardNewsDetailDialog } from '@/components/audit-and-tax/CardNewsDetailDialog';
import { getCardNews } from '@/lib/services/accountingStandardsService';
import type { Subsidiary } from '@/lib/supabase/types';
import type { CardNewsFull } from '@/lib/types/accounting-standards';

const EXCLUDED = ['Germany', 'UK', 'Singapore'];

export default function AuditAndTaxPage() {
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(true);

  // Card News
  const [cards, setCards] = useState<CardNewsFull[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardNewsFull | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('subsidiaries').select('*').order('name');
      setSubsidiaries(
        (data || []).filter((s: Subsidiary) => !EXCLUDED.some((ex) => s.name.includes(ex)))
      );
      setLoading(false);
    };
    load();
  }, []);

  const loadCards = async () => {
    setCardsLoading(true);
    const data = await getCardNews();
    setCards(data);
    setCardsLoading(false);
  };

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit and Tax</h1>
        <p className="text-sm text-gray-500 mt-0.5">감사 현황 관리 및 회계기준 카드뉴스</p>
      </div>

      {/* 탭 */}
      <Tabs
        defaultValue="audit"
        className="flex-1 flex flex-col min-h-0"
        onValueChange={(v) => { if (v === 'cardnews' && cards.length === 0) loadCards(); }}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <TabsList>
            <TabsTrigger value="audit">감사 현황</TabsTrigger>
            <TabsTrigger value="cardnews">Card News</TabsTrigger>
          </TabsList>

          {/* 귀속연도 필터 — 감사 현황 탭에서만 의미 있음 */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">귀속연도</Label>
            <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 감사 현황 그리드 */}
        <TabsContent value="audit" className="flex-1 min-h-0 mt-4">
          <AuditGrid subsidiaries={subsidiaries} fiscalYear={fiscalYear} />
        </TabsContent>

        {/* 카드뉴스 */}
        <TabsContent value="cardnews" className="flex-1 overflow-y-auto mt-4">
          {cardsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
            </div>
          ) : cards.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              카드뉴스가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <CardNewsCard key={card.id} card={card} onCardClick={setSelectedCard} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 카드뉴스 상세 다이얼로그 */}
      {selectedCard && (
        <CardNewsDetailDialog
          card={selectedCard}
          open={!!selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
