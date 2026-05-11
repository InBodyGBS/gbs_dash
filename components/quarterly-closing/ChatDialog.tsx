'use client';

/**
 * Chat Dialog Component
 * Q&A chat interface for closing topics
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getQuestionsByTopic, createQuestion, updateQuestion } from '@/lib/services/questionService';
import { createVoeInquiry } from '@/lib/services/voeService';
import { supabase } from '@/lib/supabase/client';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import type { ClosingQuestion } from '@/lib/types/reference';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ChatDialogProps {
  topicId: string;
  topicTitle: string;
  open: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  subsidiaryId?: string | null;
}

// GBS Team emails
const GBS_TEAM_EMAILS = [
  'seung-hyun.cho@inbody.com',
  'eunbik0730@inbody.com',
];

export function ChatDialog({
  topicId,
  topicTitle,
  open,
  onClose,
  currentUserEmail = 'user@example.com',
  subsidiaryId = null,
}: ChatDialogProps) {
  const [questions, setQuestions] = useState<ClosingQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answering, setAnswering] = useState(false);

  // Check if current user is GBS team member
  const isGBSTeam = GBS_TEAM_EMAILS.includes(currentUserEmail.toLowerCase());

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      // GBS team can see all questions, regular users see only public/answered
      const data = await getQuestionsByTopic(topicId, !isGBSTeam);
      setQuestions(data);
    } catch (error) {
      console.error('Failed to load questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [topicId, isGBSTeam]);

  useEffect(() => {
    if (open && topicId) {
      void loadQuestions();
    }
  }, [open, topicId, loadQuestions]);

  const handleSubmit = async () => {
    if (!newQuestion.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setSubmitting(true);
    try {
      // 1) closing_questions 에 토픽별 Q&A 로 저장 (이 페이지의 Past Q&A 표시용)
      await createQuestion({
        topic_id: topicId,
        subsidiary_id: subsidiaryId,
        question: newQuestion.trim(),
        asked_by: currentUserEmail,
        priority: 'normal',
      });

      // 2) VOE 에도 동시 등록 — entity_user 의 본인 법인 이름 + 사용자 표시명 자동 채움
      //    실패해도 closing_questions 등록은 이미 성공했으므로 사용자에겐 부분 성공 안내
      try {
        const roleInfo = await getCurrentUserRoleInfo();
        let entityName = 'Unknown';
        let authorName = currentUserEmail.split('@')[0];

        // 본인 법인 이름 (entity_user 만)
        if (!roleInfo.canSeeAll && roleInfo.entityCodes.length > 0) {
          const { data: subs } = await supabase
            .from('subsidiaries')
            .select('name')
            .in('code', roleInfo.entityCodes)
            .limit(1);
          const firstName = ((subs ?? []) as { name: string }[])[0]?.name;
          if (firstName) entityName = firstName;
        } else if (subsidiaryId) {
          // gbs_admin 이 토픽 페이지에서 보낼 때: subsidiaryId 로 조회
          const { data: sub } = await supabase
            .from('subsidiaries')
            .select('name')
            .eq('id', subsidiaryId)
            .maybeSingle();
          const n = (sub as { name?: string } | null)?.name;
          if (n) entityName = n;
        }

        // 작성자 표시명 (user_profiles.name 우선)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();
          const pn = (profile as { name?: string } | null)?.name;
          if (pn) authorName = pn;
        }

        await createVoeInquiry({
          title: `[Accounting Treatment] ${topicTitle}`,
          content: newQuestion.trim(),
          category: 'Closing',
          entity_name: entityName,
          author: authorName,
          direction: 'entity_to_gbs',
          source_category: topicId,
          source_quarter_id: null,
        });
      } catch (voeErr) {
        // VOE 동시 등록 실패는 부분 실패로 처리 — 토픽 Q&A 자체는 등록되었음
        console.warn('VOE 동시 등록 실패 (closing_questions 는 정상 등록됨):', voeErr);
      }

      toast.success('VOE 문의가 등록되었습니다.', {
        description: '본사 GBS 팀에 전달되었으며, VOE 페이지에서도 확인할 수 있습니다.',
      });
      setNewQuestion('');
      loadQuestions();
    } catch (error) {
      console.error('Failed to submit question:', error);
      toast.error('문의 등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartAnswer = (questionId: string) => {
    setAnsweringQuestionId(questionId);
    setAnswerText('');
    setIsPublic(false);
  };

  const handleCancelAnswer = () => {
    setAnsweringQuestionId(null);
    setAnswerText('');
    setIsPublic(false);
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!answerText.trim()) {
      toast.error('Please enter an answer');
      return;
    }

    setAnswering(true);
    try {
      await updateQuestion(questionId, {
        answer: answerText.trim(),
        answered_by: currentUserEmail,
        status: 'answered',
        is_public: isPublic,
      });

      toast.success('Answer submitted successfully');
      setAnsweringQuestionId(null);
      setAnswerText('');
      setIsPublic(false);
      loadQuestions();
    } catch (error) {
      console.error('Failed to submit answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setAnswering(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>💬</span>
            VOE 문의 — {topicTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
          {/* Past Q&A */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-900">
              📌 Past Q&A ({questions.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No questions yet. Be the first to ask!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="mb-2">
                      <span className="font-medium text-gray-900">Q:</span>{' '}
                      <span className="text-gray-700">{q.question}</span>
                    </div>
                    {q.answer ? (
                      <div className="ml-4 mt-2 p-3 bg-blue-50 rounded-lg">
                        <div className="mb-1">
                          <span className="font-medium text-blue-600">A:</span>{' '}
                          <span className="text-gray-800">{q.answer}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          [{q.answered_by}, {formatDate(q.answered_at)}]
                          {q.is_public && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Public
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="ml-4 mt-2">
                        {isGBSTeam ? (
                          // GBS Team: Show answer form
                          answeringQuestionId === q.id ? (
                            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                              <Textarea
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={4}
                                className="mb-3"
                              />
                              <div className="flex items-center space-x-2 mb-3">
                                <Checkbox
                                  id={`public-${q.id}`}
                                  checked={isPublic}
                                  onCheckedChange={(checked) => setIsPublic(checked === true)}
                                />
                                <Label
                                  htmlFor={`public-${q.id}`}
                                  className="text-sm text-gray-700 cursor-pointer"
                                >
                                  Make this Q&A public (visible to all subsidiaries)
                                </Label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelAnswer}
                                  disabled={answering}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitAnswer(q.id)}
                                  disabled={answering || !answerText.trim()}
                                >
                                  {answering ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Submitting...
                                    </>
                                  ) : (
                                    'Submit Answer'
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // GBS Team: Show "Answer" button
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400 italic">Waiting for answer...</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartAnswer(q.id)}
                              >
                                Answer
                              </Button>
                            </div>
                          )
                        ) : (
                          // Regular user: Just show waiting message
                          <div className="text-sm text-gray-400 italic">
                            Waiting for answer...
                          </div>
                        )}
                      </div>
                    )}
                    {q.asked_at && (
                      <div className="text-xs text-gray-400 mt-1 ml-4">
                        Asked on {formatDate(q.asked_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Question Form */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-1 text-gray-900">New Question</h4>
            <p className="text-xs text-gray-500 mb-2">
              등록 시 본사 GBS 팀에게 자동으로 전달되며, <strong>VOE 페이지</strong>에서도 확인할 수 있습니다.
            </p>
            <Textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Type your question here..."
              rows={4}
              className="mb-3"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !newQuestion.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'VOE로 문의 전송 →'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
