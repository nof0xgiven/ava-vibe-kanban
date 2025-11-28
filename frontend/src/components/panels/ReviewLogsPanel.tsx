import { Loader2, CheckCircle, XCircle, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReviewExecution } from '@/hooks/useReviewExecution';
import ReviewVirtualizedList from '@/components/logs/ReviewVirtualizedList';

interface ReviewLogsPanelProps {
  attemptId?: string;
}

export function ReviewLogsPanel({ attemptId }: ReviewLogsPanelProps) {
  const {
    reviewExecution,
    startReview,
    retryReview,
    reviewConfig,
    isStarting,
    error,
  } = useReviewExecution(attemptId);

  const status = reviewExecution?.status ?? 'none';
  const canRetry = status === 'failed' && (reviewExecution?.retryCount ?? 0) < reviewConfig.max_retries;

  // Show logs if we have a running or completed review process
  if (reviewExecution?.processId && (status === 'running' || status === 'completed' || status === 'failed')) {
    return (
      <div className="h-full flex flex-col">
        {/* Status bar */}
        <div className="shrink-0 px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'running' && (
              <>
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="text-sm font-medium">Review in progress...</span>
              </>
            )}
            {status === 'completed' && (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Review completed</span>
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Review failed</span>
              </>
            )}
          </div>
          {canRetry && (
            <Button size="sm" variant="outline" onClick={retryReview} disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Retry
            </Button>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ReviewVirtualizedList processId={reviewExecution.processId} />
        </div>
      </div>
    );
  }

  // No review yet - show start button
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <div className="text-muted-foreground">
          <p className="text-sm">No review has been run for this task attempt.</p>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <Button onClick={startReview} disabled={isStarting || !attemptId}>
          {isStarting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Start Review
        </Button>
      </div>
    </div>
  );
}
