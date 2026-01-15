'use client';

/**
 * Reference Page
 * Year-End Closing Guide and Q&A
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { getTopics, searchTopics } from '@/lib/services/topicService';
import { TopicGrid } from '@/components/quarterly-closing/TopicGrid';
import { TopicDetail } from '@/components/quarterly-closing/TopicDetail';
import { ChatDialog } from '@/components/quarterly-closing/ChatDialog';
import type { ClosingTopic } from '@/lib/types/reference';
import { supabase } from '@/lib/supabase/client';

export default function ReferencePage() {
  const [topics, setTopics] = useState<ClosingTopic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<ClosingTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ClosingTopic | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [subsidiaryId, setSubsidiaryId] = useState<string | null>(null);

  useEffect(() => {
    loadTopics();
    loadUserInfo();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    } else {
      setFilteredTopics(topics);
    }
  }, [searchQuery, topics]);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const data = await getTopics();
      setTopics(data);
      setFilteredTopics(data);
    } catch (error) {
      console.error('Failed to load topics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load topics: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || '');
      }

      // Get subsidiary ID from user metadata or session
      // This is a placeholder - adjust based on your auth setup
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        // You may need to fetch subsidiary_id from user metadata or a separate table
        // For now, we'll leave it as null
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setFilteredTopics(topics);
      return;
    }

    try {
      const results = await searchTopics(query);
      setFilteredTopics(results);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    }
  };

  const handleTopicClick = (topicId: string) => {
    const topic = topics.find((t) => t.id === topicId);
    if (topic) {
      setSelectedTopic(topic);
    }
  };

  const handleBack = () => {
    setSelectedTopic(null);
  };

  const handleOpenChat = () => {
    if (selectedTopic) {
      setChatOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading topics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reference - Year-End Closing Guide
        </h1>
        <p className="text-gray-600">
          Find closing adjustment guides and ask questions to the GBS team
        </p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedTopic ? (
          /* Topic Detail View */
          <div className="pb-6">
            <TopicDetail
              topic={selectedTopic}
              onBack={handleBack}
              onOpenChat={handleOpenChat}
            />
          </div>
        ) : (
          /* Topic Grid View */
          <div className="space-y-6 pb-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search closing topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Topic Grid */}
            {filteredTopics.length === 0 && !loading ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    No topics available
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    The closing topics table has not been created yet. Please run the database migration to set up the reference page.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-blue-900 mb-2">To set up:</p>
                    <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
                      <li>Go to Supabase SQL Editor</li>
                      <li>Run the SQL from <code className="bg-blue-100 px-1 rounded">docs/reference-schema.sql</code></li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <TopicGrid topics={filteredTopics} onTopicClick={handleTopicClick} />
            )}

            {/* Contact Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-2">Contact the GBS team:</p>
              <div className="text-sm text-gray-700">
                <p>Rosa: seung-hyun.cho@inbody.com</p>
                <p>Grace: eunbik0730@inbody.com</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Dialog */}
      {selectedTopic && (
        <ChatDialog
          topicId={selectedTopic.id}
          topicTitle={selectedTopic.title}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          currentUserEmail={currentUserEmail}
          subsidiaryId={subsidiaryId}
        />
      )}
    </div>
  );
}
