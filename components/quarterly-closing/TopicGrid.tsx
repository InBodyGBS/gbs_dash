'use client';

/**
 * Topic Grid Component
 * Grid layout for topic cards
 */

import { TopicCard } from './TopicCard';
import type { ClosingTopic } from '@/lib/types/reference';

interface TopicGridProps {
  topics: ClosingTopic[];
  onTopicClick: (topicId: string) => void;
}

export function TopicGrid({ topics, onTopicClick }: TopicGridProps) {
  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-600 mb-2">No topics found</p>
        <p className="text-sm text-gray-500">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} onClick={onTopicClick} />
      ))}
    </div>
  );
}
