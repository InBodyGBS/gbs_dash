'use client';

/**
 * Topic Detail Component
 * Detailed view of a closing topic
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ClosingTopic } from '@/lib/types/reference';

const CONTACT_EMAIL = 'eunbik0730@inbody.com';

interface TopicDetailProps {
  topic: ClosingTopic;
  onBack: () => void;
  onOpenChat: () => void;
}

export function TopicDetail({ topic, onBack, onOpenChat }: TopicDetailProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Topics
        </Button>
        <Button onClick={onOpenChat} className="gap-2">
          <MessageCircle className="w-4 h-4" />
          Chat
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        {/* Title Section */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b">
          <span className="text-6xl">{topic.icon}</span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{topic.title}</h1>
            <p className="text-gray-600">{topic.description}</p>
          </div>
        </div>

        {/* Markdown Content */}
        <div className="prose prose-slate max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold mt-8 mb-4 text-gray-900">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium mt-4 mb-2 text-gray-800">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">{children}</ol>,
              li: ({ children }) => <li className="ml-4">{children}</li>,
              code: ({ children }) => (
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
            }}
          >
            {topic.content}
          </ReactMarkdown>
        </div>

        {/* Contact Info */}
        <div className="mt-8 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-2">Need help? Contact:</p>
          <div className="text-sm text-gray-700">
            <p>Rosa: seung-hyun.cho@inbody.com</p>
            <p>Grace: {CONTACT_EMAIL}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
