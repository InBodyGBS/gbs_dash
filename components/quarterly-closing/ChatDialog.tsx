'use client';

/**
 * Chat Dialog Component
 * Q&A chat interface for closing topics
 */

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (open && topicId) {
      loadQuestions();
    }
  }, [open, topicId]);

  const loadQuestions = async () => {
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
  };

  const handleSubmit = async () => {
    if (!newQuestion.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setSubmitting(true);
    try {
      await createQuestion({
        topic_id: topicId,
        subsidiary_id: subsidiaryId,
        question: newQuestion.trim(),
        asked_by: currentUserEmail,
        priority: 'normal',
      });

      toast.success('Question submitted successfully');
      setNewQuestion('');
      loadQuestions();
    } catch (error) {
      console.error('Failed to submit question:', error);
      toast.error('Failed to submit question');
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
            Closing Questions - {topicTitle}
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
            <h4 className="font-medium mb-2 text-gray-900">New Question:</h4>
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
                  'Submit Question →'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
