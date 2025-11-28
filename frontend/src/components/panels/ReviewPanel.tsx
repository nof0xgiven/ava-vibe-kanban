import { useTranslation } from 'react-i18next';
import {
  Play,
  RotateCcw,
  SkipForward,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useReviewExecution } from '@/hooks/useReviewExecution';
import ProcessLogsViewer from '@/components/tasks/TaskDetails/ProcessLogsViewer';
import type { ReviewStatus, ReviewFeedbackItem } from '@/types/review';

interface ReviewPanelProps {
  attemptId?: string;
  taskStatus?: string;
}

const statusConfig: Record<ReviewStatus, { icon: typeof Clock; label: string; color: string }> = {
  none: { icon: Clock, label: 'Not Started', color: 'text-muted-foreground' },
  pending: { icon: Clock, label: 'Pending', color: 'text-yellow-500' },
  running: { icon: Loader2, label: 'Running', color: 'text-blue-500' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-destructive' },
  skipped: { icon: SkipForward, label: 'Skipped', color: 'text-muted-foreground' },
};

function FeedbackItem({ item }: { item: ReviewFeedbackItem }) {
  const severityColors = {
    info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    warning: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    error: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  const typeIcons = {
    suggestion: MessageSquare,
    issue: AlertCircle,
    praise: CheckCircle,
    question: MessageSquare,
  };

  const Icon = typeIcons[item.type];

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Icon className={cn('h-4 w-4 mt-0.5', severityColors[item.severity])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{item.title}</span>
            <Badge variant="outline" className={cn('text-xs', severityColors[item.severity])}>
              {item.type}
            </Badge>
          </div>
          {item.filePath && (
            <p className="text-xs text-muted-foreground mt-1">
              {item.filePath}
              {item.lineNumber && `:${item.lineNumber}`}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      {item.codeSnippet && (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          <code>{item.codeSnippet}</code>
        </pre>
      )}
    </div>
  );
}

export function ReviewPanel({ attemptId, taskStatus }: ReviewPanelProps) {
  useTranslation('tasks');
  const {
    reviewExecution,
    reviewFeedback,
    isReviewRunning,
    startReview,
    retryReview,
    skipReview,
    reviewConfig,
    isStarting,
    error,
  } = useReviewExecution(attemptId);

  const status = reviewExecution?.status ?? 'none';
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = statusConfig[status];
  const canRetry = status === 'failed' && (reviewExecution?.retryCount ?? 0) < reviewConfig.max_retries;
  const showInReviewPrompt = taskStatus === 'inreview' && status === 'none';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Code Review</h2>
            <div className={cn('flex items-center gap-1.5', statusColor)}>
              <StatusIcon className={cn('h-4 w-4', status === 'running' && 'animate-spin')} />
              <span className="text-sm">{statusLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(status === 'none' || status === 'skipped') && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={skipReview}
                  disabled={isStarting || status === 'skipped'}
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={startReview}
                  disabled={isStarting || !attemptId}
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Start Review
                </Button>
              </>
            )}
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={retryReview}
                disabled={isStarting}
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Retry ({reviewExecution?.retryCount ?? 0}/{reviewConfig.max_retries})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showInReviewPrompt && reviewConfig.auto_review_enabled && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Auto-review is enabled. The review will start automatically.
            </AlertDescription>
          </Alert>
        )}

        {showInReviewPrompt && !reviewConfig.auto_review_enabled && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Ready for Review</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start a code review to get AI-powered feedback on the changes.
                  </p>
                </div>
                <Button onClick={startReview} disabled={isStarting || !attemptId}>
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isReviewRunning && reviewExecution?.processId && (
          <div className="flex flex-col h-full min-h-[400px]">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-sm font-medium">Review in Progress</span>
            </div>
            <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30">
              <ProcessLogsViewer processId={reviewExecution.processId} />
            </div>
          </div>
        )}

        {isReviewRunning && !reviewExecution?.processId && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
                <div>
                  <h3 className="font-medium">Starting Review...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preparing to analyze your code changes...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'completed' && reviewFeedback && (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Review Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{reviewFeedback.overallSummary}</p>
                {reviewFeedback.score !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Quality Score:</span>
                    <Badge variant={reviewFeedback.score >= 70 ? 'default' : 'destructive'}>
                      {reviewFeedback.score}/100
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feedback Items */}
            {reviewFeedback.items.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">
                  Feedback ({reviewFeedback.items.length})
                </h3>
                <div className="space-y-2">
                  {reviewFeedback.items.map((item) => (
                    <FeedbackItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'completed' && !reviewFeedback && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div>
                  <h3 className="font-medium">Review Completed</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviewExecution?.summary || 'No issues found.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'failed' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <XCircle className="h-12 w-12 mx-auto text-destructive" />
                <div>
                  <h3 className="font-medium">Review Failed</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviewExecution?.error || 'An error occurred during review.'}
                  </p>
                </div>
                {canRetry && (
                  <Button variant="outline" onClick={retryReview} disabled={isStarting}>
                    {isStarting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Retry Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'skipped' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <SkipForward className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Review Skipped</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can start a review anytime by clicking the button above.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}