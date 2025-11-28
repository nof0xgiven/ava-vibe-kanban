import type { ReviewConfig as SharedReviewConfig } from 'shared/types';

/**
 * Review status for task attempts
 */
export type ReviewStatus =
  | 'none' // No review triggered yet
  | 'pending' // Review queued, waiting to start
  | 'running' // Review agent currently executing
  | 'completed' // Review finished successfully
  | 'failed' // Review failed
  | 'skipped'; // User skipped the review

/**
 * Re-export ReviewConfig from shared types for convenience
 */
export type ReviewConfig = SharedReviewConfig;

/**
 * Default review configuration (for reference only - actual defaults come from backend Config)
 */
export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  auto_review_enabled: false,
  review_profile: null,
  prompt_template: null,
  max_retries: 1,
  include_in_follow_up: true,
};

/**
 * Review execution state for an attempt
 */
export interface ReviewExecution {
  status: ReviewStatus;
  processId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  retryCount: number;
  error: string | null;
}

/**
 * Review feedback item from the review agent
 */
export interface ReviewFeedbackItem {
  id: string;
  type: 'suggestion' | 'issue' | 'praise' | 'question';
  severity: 'info' | 'warning' | 'error';
  filePath: string | null;
  lineNumber: number | null;
  title: string;
  description: string;
  codeSnippet: string | null;
}

/**
 * Complete review feedback from the review agent
 */
export interface ReviewFeedback {
  attemptId: string;
  items: ReviewFeedbackItem[];
  overallSummary: string;
  score: number | null; // 0-100 quality score if available
  generatedAt: string;
}