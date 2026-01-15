'use client';

/**
 * Topic Card Component
 * Individual topic card for the grid
 */

import { Card, CardContent } from '@/components/ui/card';
import type { ClosingTopic } from '@/lib/types/reference';

interface TopicCardProps {
  topic: ClosingTopic;
  onClick: (topicId: string) => void;
}

export function TopicCard({ topic, onClick }: TopicCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-l-4"
      style={{ borderLeftColor: getCategoryColor(topic.category) }}
      onClick={() => onClick(topic.id)}
    >
      <CardContent className="p-6 text-center">
        <div className="text-5xl mb-4">{topic.icon}</div>
        <h3 className="font-semibold text-lg mb-2 text-gray-900">{topic.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2">{topic.description}</p>
      </CardContent>
    </Card>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    revenue: '#10B981', // Green
    inventory: '#3B82F6', // Blue
    expenses: '#F59E0B', // Orange
    receivables: '#8B5CF6', // Purple
    currency: '#EC4899', // Pink
    assets: '#6366F1', // Indigo
  };
  return colors[category] || '#6B7280'; // Gray default
}
