-- Add review_summary column to execution_processes for storing review agent output
ALTER TABLE execution_processes ADD COLUMN review_summary TEXT;