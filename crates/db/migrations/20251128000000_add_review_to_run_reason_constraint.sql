-- Add 'review' to run_reason CHECK constraint
-- SQLite doesn't support ALTER CONSTRAINT, so we need to recreate the column

-- 1. Add the replacement column with the wider CHECK including 'review'
ALTER TABLE execution_processes
  ADD COLUMN run_reason_new TEXT NOT NULL DEFAULT 'codingagent'
    CHECK (run_reason_new IN ('setupscript',
                              'cleanupscript',
                              'codingagent',
                              'devserver',
                              'review'));

-- 2. Copy existing values across
UPDATE execution_processes
  SET run_reason_new = run_reason;

-- 3. Drop any indexes that mention the old column
DROP INDEX IF EXISTS idx_execution_processes_type;

-- 4. Remove the old column
ALTER TABLE execution_processes DROP COLUMN run_reason;

-- 5. Rename the new column back to the canonical name
ALTER TABLE execution_processes
  RENAME COLUMN run_reason_new TO run_reason;

-- 6. Re-create the index
CREATE INDEX idx_execution_processes_run_reason
        ON execution_processes(run_reason);
