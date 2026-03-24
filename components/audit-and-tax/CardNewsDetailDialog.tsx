/**
 * 카드뉴스 상세 다이얼로그 컴포넌트
 */

'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { CardNewsDetail } from '@/lib/types/accounting-standards';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, AlertTriangle, Info, Lightbulb, ExternalLink } from 'lucide-react';
import { getCardNewsDetail } from '@/lib/services/accountingStandardsService';

interface CardNewsDetailDialogProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardNewsDetailDialog({
  cardId,
  open,
  onOpenChange,
}: CardNewsDetailDialogProps) {
  const [card, setCard] = useState<CardNewsDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const keyPointsText: string[] = Array.isArray(card?.key_points)
    ? card!.key_points.map((p) => String(p))
    : [];

  const keyPointsNodes: ReactNode = keyPointsText.map((point, index) => (
    <li key={index}>{point}</li>
  ));

  useEffect(() => {
    if (open && cardId) {
      // Avoid synchronous state updates directly in the effect body.
      Promise.resolve().then(() => setLoading(true));
      getCardNewsDetail(cardId)
        .then((data) => {
          setCard(data);
        })
        .catch((error) => {
          console.error('Error loading card detail:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      Promise.resolve().then(() => setCard(null));
    }
  }, [open, cardId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {loading ? '로딩 중...' : card ? card.title : '카드뉴스 상세'}
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : card ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              {card.category_icon && (
                <span className="text-3xl" style={{ color: card.category_color || undefined }}>
                  {card.category_icon}
                </span>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: card.category_color
                        ? `${card.category_color}20`
                        : undefined,
                      color: card.category_color || undefined,
                    }}
                  >
                    {card.category_name}
                  </Badge>
                  {card.is_important && (
                    <Badge variant="default" className="bg-yellow-500">
                      <Star className="w-3 h-3 mr-1 fill-white" />
                      중요
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-semibold">
                  {card.title}
                </h2>
                {card.subtitle && (
                  <p className="text-muted-foreground mt-1">{card.subtitle}</p>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            {/* 본문 */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">본문</h3>
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {card.content}
                </p>
              </div>

              {/* 핵심 포인트 */}
              <div>
                <h3 className="font-semibold mb-2">핵심 포인트</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {keyPointsNodes}
                </ul>
              </div>

              {/* 예시 */}
              {card.examples && (
                <div>
                  <h3 className="font-semibold mb-2">예시</h3>
                  <div className="text-sm space-y-2">
                    {typeof card.examples === 'object' && !Array.isArray(card.examples) ? (
                      Object.entries(card.examples).map(([key, value]) => (
                        <div key={key} className="bg-muted p-3 rounded-md">
                          <p className="font-medium mb-1">{key}</p>
                          {Array.isArray(value) ? (
                            <ul className="list-disc list-inside space-y-1">
                              {value.map((item: unknown, idx: number) => (
                                <li key={idx}>{String(item)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{String(value)}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p>{String(card.examples)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 시각 데이터 */}
              {card.visual_data && (
                <div>
                  <h3 className="font-semibold mb-2">시각 데이터</h3>
                  {card.visual_data.type === 'table' && card.visual_data.data?.headers && (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {card.visual_data.data.headers.map((header: string, idx: number) => (
                              <TableHead key={idx}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {card.visual_data.data.rows?.map((row: unknown[], rowIdx: number) => (
                            <TableRow key={rowIdx}>
                              {row.map((cell: unknown, cellIdx: number) => (
                                <TableCell key={cellIdx}>{String(cell)}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {card.visual_data.type === 'chart' && (
                    <div className="bg-muted p-4 rounded-md text-sm">
                      <p className="text-muted-foreground">
                        차트 데이터: {JSON.stringify(card.visual_data.data, null, 2)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 실무 팁 */}
              {card.practical_tips && card.practical_tips.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">실무 팁</h3>
                  <div className="space-y-2">
                    {card.practical_tips.map((tip, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md border-l-4 ${
                          tip.tip_type === 'warning'
                            ? 'bg-red-50 border-red-500'
                            : tip.tip_type === 'best_practice'
                            ? 'bg-green-50 border-green-500'
                            : 'bg-blue-50 border-blue-500'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {tip.tip_type === 'warning' && (
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          {tip.tip_type === 'best_practice' && (
                            <Lightbulb className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          )}
                          {(!tip.tip_type || tip.tip_type === 'info') && (
                            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm flex-1">{tip.tip_content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 참고자료 */}
              {card.references && card.references.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">참고자료</h3>
                  <div className="space-y-2">
                    {card.references.map((ref) => (
                      <div key={ref.id} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                        <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{ref.reference_name}</p>
                          {ref.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {ref.description}
                            </p>
                          )}
                          {ref.reference_url && (
                            <a
                              href={ref.reference_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              {ref.reference_url}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 태그 */}
              {card.tags && card.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {card.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : !loading ? (
          <div className="py-8 text-center text-muted-foreground">
            카드뉴스를 불러올 수 없습니다.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
