/**
 * Audit and Tax Compliance 페이지
 * 회계기준 카드뉴스
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CardNewsCard } from '@/components/audit-and-tax/CardNewsCard';
import { CardNewsDetailDialog } from '@/components/audit-and-tax/CardNewsDetailDialog';
import {
  getAccountingStandards,
  getCardCategories,
  getCardNews,
} from '@/lib/services/accountingStandardsService';
import type {
  AccountingStandard,
  CardCategory,
  CardNewsFull,
} from '@/lib/types/accounting-standards';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AuditAndTaxPage() {
  const [standards, setStandards] = useState<AccountingStandard[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string>('IFRS'); // DB의 standard_code는 IFRS로 유지

  // 표시 이름 매핑
  const getStandardDisplayName = (standardCode: string) => {
    if (standardCode === 'IFRS') return 'USA_IFRS';
    return standardCode;
  };
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cards, setCards] = useState<CardNewsFull[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardNewsFull[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 회계기준 목록 로드
  useEffect(() => {
    async function loadStandards() {
      const data = await getAccountingStandards();
      setStandards(data);
      if (data.length > 0 && !selectedStandard) {
        setSelectedStandard(data[0].standard_code);
      }
    }
    loadStandards();
  }, []);

  // 카테고리 목록 로드
  useEffect(() => {
    async function loadCategories() {
      if (!selectedStandard) return;
      setLoading(true);
      const data = await getCardCategories(selectedStandard);
      setCategories(data);
      setLoading(false);
    }
    loadCategories();
  }, [selectedStandard]);

  // 카드뉴스 로드
  useEffect(() => {
    async function loadCards() {
      if (!selectedStandard) return;
      setLoading(true);
      const categoryName = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await getCardNews(selectedStandard, categoryName, searchQuery);
      setCards(data);
      setLoading(false);
    }
    loadCards();
  }, [selectedStandard, selectedCategory, searchQuery]);

  // 필터링된 카드 목록 (서비스에서 이미 검색 필터링이 적용됨)
  useEffect(() => {
    setFilteredCards(cards);
  }, [cards]);

  // 카드 클릭 핸들러
  const handleCardClick = (card: CardNewsFull) => {
    setSelectedCardId(card.id);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Audit and Tax Compliance</h1>
          <p className="text-gray-500 mt-2">회계기준 카드뉴스</p>
        </div>

        {/* 회계기준 선택 탭 */}
        <Tabs
          value={selectedStandard}
          onValueChange={(value) => {
            setSelectedStandard(value);
            setSelectedCategory('all');
            setSearchQuery('');
          }}
          className="mb-6"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            {standards.map((standard) => (
              <TabsTrigger key={standard.id} value={standard.standard_code}>
                {getStandardDisplayName(standard.standard_code)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* 필터 및 검색 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* 카테고리 필터 */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.category_name}>
                  <div className="flex items-center gap-2">
                    {category.icon && <span>{category.icon}</span>}
                    <span>{category.category_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 검색 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="제목, 본문, 태그로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* 카드뉴스 그리드 */}
        {!loading && (
          <>
            {filteredCards.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">카드뉴스가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                {filteredCards.map((card) => (
                  <CardNewsCard
                    key={card.id}
                    card={card}
                    onCardClick={handleCardClick}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 상세 다이얼로그 */}
        <CardNewsDetailDialog
          cardId={selectedCardId}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      </div>
    </div>
  );
}
