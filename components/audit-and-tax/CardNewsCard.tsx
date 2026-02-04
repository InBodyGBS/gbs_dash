/**
 * 카드뉴스 카드 컴포넌트
 */

'use client';

import { CardNewsFull } from '@/lib/types/accounting-standards';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface CardNewsCardProps {
  card: CardNewsFull;
  onCardClick: (card: CardNewsFull) => void;
}

export function CardNewsCard({ card, onCardClick }: CardNewsCardProps) {
  // 본문 미리보기 (3줄)
  const previewContent = card.content
    .split('\n')
    .slice(0, 3)
    .join('\n')
    .substring(0, 150);

  return (
    <Card
      className="h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={() => onCardClick(card)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {card.category_icon && (
              <span className="text-2xl flex-shrink-0" style={{ color: card.category_color || undefined }}>
                {card.category_icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <Badge
                variant="secondary"
                className="text-xs mb-1"
                style={{
                  backgroundColor: card.category_color
                    ? `${card.category_color}20`
                    : undefined,
                  color: card.category_color || undefined,
                }}
              >
                {card.category_name}
              </Badge>
              <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                {card.is_important && (
                  <Star className="inline-block w-4 h-4 text-yellow-500 mr-1 fill-yellow-500" />
                )}
                {card.title}
              </h3>
              {card.subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground flex-1 line-clamp-3 whitespace-pre-line">
          {previewContent}
          {card.content.length > 150 && '...'}
        </p>
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {card.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {card.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{card.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          className="mt-4 w-full justify-end"
          onClick={(e) => {
            e.stopPropagation();
            onCardClick(card);
          }}
        >
          자세히 보기 →
        </Button>
      </CardContent>
    </Card>
  );
}
