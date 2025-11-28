import type { TaskAttempt, TaskWithAttemptStatus } from 'shared/types';
import VirtualizedList from '@/components/logs/VirtualizedList';
import { TaskFollowUpSection } from '@/components/tasks/TaskFollowUpSection';
import { EntriesProvider } from '@/contexts/EntriesContext';
import { RetryUiProvider } from '@/contexts/RetryUiContext';
import { ReviewLogsPanel } from '@/components/panels/ReviewLogsPanel';
import { useReviewExecution } from '@/hooks/useReviewExecution';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2, MessageSquare } from 'lucide-react';

interface TaskAttemptPanelProps {
  attempt: TaskAttempt | undefined;
  task: TaskWithAttemptStatus | null;
  children: (sections: { logs: ReactNode; followUp: ReactNode }) => ReactNode;
}

type TabType = 'task' | 'review';

function ReviewTabIcon({ attemptId }: { attemptId?: string }) {
  const { reviewExecution } = useReviewExecution(attemptId);
  const status = reviewExecution?.status ?? 'none';

  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
  }
  if (status === 'completed') {
    return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  }
  return <MessageSquare className="h-3.5 w-3.5" />;
}

const TaskAttemptPanel = ({
  attempt,
  task,
  children,
}: TaskAttemptPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('task');

  if (!attempt) {
    return <div className="p-6 text-muted-foreground">Loading attempt...</div>;
  }

  if (!task) {
    return <div className="p-6 text-muted-foreground">Loading task...</div>;
  }

  return (
    <EntriesProvider key={attempt.id}>
      <RetryUiProvider attemptId={attempt.id}>
        <div className="h-full flex flex-col">
          {/* Tabs */}
          <div className="shrink-0 border-b bg-background">
            <div className="flex">
              <button
                onClick={() => setActiveTab('task')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'task'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                Task
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'review'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                Review
                <ReviewTabIcon attemptId={attempt.id} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'task' ? (
              children({
                logs: (
                  <VirtualizedList key={attempt.id} attempt={attempt} task={task} />
                ),
                followUp: (
                  <TaskFollowUpSection
                    task={task}
                    selectedAttemptId={attempt.id}
                    jumpToLogsTab={() => setActiveTab('task')}
                  />
                ),
              })
            ) : (
              <ReviewLogsPanel attemptId={attempt.id} />
            )}
          </div>
        </div>
      </RetryUiProvider>
    </EntriesProvider>
  );
};

export default TaskAttemptPanel;
