'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

interface RewriteFeedbackProps {
  taskId: string;
  rewrittenText: string;
  style: string;
}

export function RewriteFeedback({
  taskId,
  rewrittenText,
  style,
}: RewriteFeedbackProps) {
  const t = useTranslations('ai.media.extractor.rewrite.feedback');
  const [feedbackType, setFeedbackType] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (type: 'up' | 'down', textComment?: string) => {
    setIsSending(true);
    try {
      const response = await fetch('/api/media/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          rating: type === 'up' ? 5 : 1,
          comment: textComment || '',
          style,
          metadata: {
            textLength: rewrittenText.length,
            style,
          },
        }),
      });

      const data = await response.json();

      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to submit feedback');
      }

      setIsSubmitted(true);
      toast.success(t('submit_success', { defaultValue: 'Thank you for your feedback!' }));
    } catch (error: any) {
      console.error('Feedback submission failed:', error);
      toast.error(error.message || t('submit_failed', { defaultValue: 'Failed to submit feedback' }));
    } finally {
      setIsSending(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 p-3 text-sm text-green-600 dark:text-green-400 animate-in fade-in duration-500">
        <CheckCircle2 className="h-4 w-4" />
        <span>{t('thank_you', { defaultValue: 'Thank you for your feedback! We will continue to improve this style.' })}</span>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground italic">
          {t('question', { defaultValue: 'Was this helpful?' })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFeedbackType('up');
              handleSubmit('up');
            }}
            disabled={isSending}
            className={`p-2 rounded-lg transition-all ${
              feedbackType === 'up'
                ? 'bg-green-500/20 text-green-500 dark:bg-green-500/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-green-500'
            } disabled:opacity-50`}
          >
            {isSending && feedbackType === 'up' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setFeedbackType('down')}
            disabled={isSending}
            className={`p-2 rounded-lg transition-all ${
              feedbackType === 'down'
                ? 'bg-red-500/20 text-red-500 dark:bg-red-500/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500'
            } disabled:opacity-50`}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Show feedback form when user clicks "down" */}
      {feedbackType === 'down' && (
        <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('comment_placeholder', {
              defaultValue: 'Tell us what you didn\'t like? (e.g., too verbose, wrong tone, instruction not followed...)',
            })}
            className="w-full min-h-[80px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            rows={3}
          />
          <Button
            onClick={() => handleSubmit('down', comment)}
            disabled={isSending || !comment.trim()}
            size="sm"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
          >
            {isSending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('submitting', { defaultValue: 'Submitting...' })}
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                {t('submit', { defaultValue: 'Submit Feedback' })}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
