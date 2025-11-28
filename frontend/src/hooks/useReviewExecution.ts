import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ExecutionProcess, ReviewConfig } from 'shared/types';
import type {
  ReviewExecution,
  ReviewFeedback,
  ReviewStatus,
} from '@/types/review';
import { useUserSystem } from '@/components/ConfigProvider';
import { useExecutionProcessesContext } from '@/contexts/ExecutionProcessesContext';
import { attemptsApi } from '@/lib/api';

const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  auto_review_enabled: false,
  review_profile: null,
  prompt_template: null,
  max_retries: 3,
  include_in_follow_up: true,
};

interface UseReviewExecutionResult {
  // Review execution state
  reviewExecution: ReviewExecution | null;
  reviewFeedback: ReviewFeedback | null;
  isReviewRunning: boolean;

  // Actions
  startReview: () => Promise<void>;
  retryReview: () => Promise<void>;
  skipReview: () => void;
  clearReviewFeedback: () => void;

  // Config
  reviewConfig: ReviewConfig;

  // Loading states
  isStarting: boolean;
  error: string | null;
}

/**
 * Derives ReviewExecution state from an ExecutionProcess
 */
function deriveReviewExecution(process: ExecutionProcess | null, retryCount: number): ReviewExecution | null {
  if (!process) return null;

  let status: ReviewStatus = 'none';
  switch (process.status) {
    case 'running':
      status = 'running';
      break;
    case 'completed':
      status = 'completed';
      break;
    case 'failed':
    case 'killed':
      status = 'failed';
      break;
  }

  return {
    status,
    processId: process.id,
    startedAt: process.started_at,
    completedAt: process.completed_at,
    summary: process.review_summary,
    retryCount,
    error: process.status === 'failed' ? 'Review failed' : null,
  };
}

/**
 * Hook for managing review execution state for a task attempt.
 * Integrates with backend review API and streams execution process state.
 */
export function useReviewExecution(attemptId?: string): UseReviewExecutionResult {
  const { config } = useUserSystem();
  const reviewConfig = config?.review ?? DEFAULT_REVIEW_CONFIG;

  // Get execution processes from context
  const { executionProcessesVisible } = useExecutionProcessesContext();

  // Local state for UI feedback
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<ReviewFeedback | null>(null);

  // Find all review processes for this attempt
  const reviewProcesses = useMemo(
    () => executionProcessesVisible.filter((p) => p.run_reason === 'review'),
    [executionProcessesVisible]
  );

  // Get the latest review process
  const latestReviewProcess = useMemo(
    () => reviewProcesses.length > 0 ? reviewProcesses[reviewProcesses.length - 1] : null,
    [reviewProcesses]
  );

  // Calculate retry count (number of review processes minus 1, minimum 0)
  const retryCount = Math.max(0, reviewProcesses.length - 1);

  // Derive review execution state from process
  const reviewExecution = useMemo(() => {
    if (skipped) {
      return {
        status: 'skipped' as ReviewStatus,
        processId: null,
        startedAt: null,
        completedAt: new Date().toISOString(),
        summary: null,
        retryCount,
        error: null,
      };
    }
    return deriveReviewExecution(latestReviewProcess, retryCount);
  }, [latestReviewProcess, retryCount, skipped]);

  const isReviewRunning = useMemo(
    () => reviewExecution?.status === 'running' || reviewExecution?.status === 'pending',
    [reviewExecution?.status]
  );

  // Reset skipped state when attempt changes
  useEffect(() => {
    setSkipped(false);
    setError(null);
    setReviewFeedback(null);
  }, [attemptId]);

  const startReview = useCallback(async () => {
    if (!attemptId || isReviewRunning) return;

    setIsStarting(true);
    setError(null);
    setSkipped(false);

    try {
      await attemptsApi.startReview(attemptId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start review';
      setError(message);
    } finally {
      setIsStarting(false);
    }
  }, [attemptId, isReviewRunning]);

  const retryReview = useCallback(async () => {
    if (!attemptId || isReviewRunning) return;
    if (retryCount >= reviewConfig.max_retries) {
      setError(`Maximum retry limit (${reviewConfig.max_retries}) reached`);
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      await attemptsApi.retryReview(attemptId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry review';
      setError(message);
    } finally {
      setIsStarting(false);
    }
  }, [attemptId, isReviewRunning, retryCount, reviewConfig.max_retries]);

  const skipReview = useCallback(() => {
    setSkipped(true);
    setError(null);
  }, []);

  const clearReviewFeedback = useCallback(() => {
    setReviewFeedback(null);
  }, []);

  return {
    reviewExecution,
    reviewFeedback,
    isReviewRunning,
    startReview,
    retryReview,
    skipReview,
    clearReviewFeedback,
    reviewConfig,
    isStarting,
    error,
  };
}