'use client';

/**
 * 법인 카드 그리드 컴포넌트
 * 카드 뉴스 스타일로 법인을 섹션별로 표시
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Subsidiary } from '@/lib/supabase/types';
import { REGION_COLORS } from '@/lib/constants/regions';
import { cn } from '@/lib/utils';
import { MapPin, Building2 } from 'lucide-react';

interface SubsidiaryCardGridProps {
  subsidiaries: Subsidiary[];
  selectedId?: string | null;
  onSubsidiaryClick: (id: string) => void;
}

/**
 * 카드 뉴스 스타일로 법인을 섹션별로 표시
 * 국내/해외로 구분하여 표시
 */
export const SubsidiaryCardGrid = ({
  subsidiaries,
  selectedId,
  onSubsidiaryClick,
}: SubsidiaryCardGridProps) => {
  // 국내와 해외로 분류
  const { domestic, overseas } = useMemo(() => {
    const domesticList: Subsidiary[] = [];
    const overseasList: Subsidiary[] = [];

    subsidiaries.forEach((sub) => {
      const isDomestic =
        sub.country === '한국' ||
        sub.country === 'Korea' ||
        sub.country === 'South Korea' ||
        sub.country === '대한민국';

      if (isDomestic) {
        domesticList.push(sub);
      } else {
        overseasList.push(sub);
      }
    });

    return {
      domestic: domesticList,
      overseas: overseasList,
    };
  }, [subsidiaries]);

  // 법인 카드 렌더링
  const renderSubsidiaryCard = (sub: Subsidiary) => {
    const isSelected = selectedId === sub.id;
    const regionColor = REGION_COLORS[sub.region] || '#6B7280';
    const displayName = sub.name.replace('InBody ', '');

    return (
      <Card
        key={sub.id}
        className={cn(
          'cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
          isSelected
            ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]'
            : 'hover:border-gray-300'
        )}
        onClick={() => onSubsidiaryClick(sub.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                {displayName}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>
                  {sub.city}, {sub.country}
                </span>
              </div>
            </div>
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: regionColor }}
              title={sub.region}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {sub.region}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Building2 className="h-3 w-3" />
              <span>{sub.code}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 국내 법인 섹션 */}
        {domestic.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-blue-500 rounded-full" />
              <h2 className="text-2xl font-bold text-gray-900">국내 법인</h2>
              <Badge variant="secondary" className="text-xs">
                {domestic.length}개
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {domestic.map((sub) => renderSubsidiaryCard(sub))}
            </div>
          </section>
        )}

        {/* 해외 법인 섹션 */}
        {overseas.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-green-500 rounded-full" />
              <h2 className="text-2xl font-bold text-gray-900">해외 법인</h2>
              <Badge variant="secondary" className="text-xs">
                {overseas.length}개
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {overseas.map((sub) => renderSubsidiaryCard(sub))}
            </div>
          </section>
        )}

        {/* 데이터가 없을 때 */}
        {domestic.length === 0 && overseas.length === 0 && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">법인 데이터가 없습니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

