-- The worker that completed the agent step before your current step, which
-- wait_for_work hands the task back to once your step is done.
ALTER TABLE tasks ADD COLUMN resume_with TEXT REFERENCES sessions (id);

CREATE INDEX tasks_resume_with ON tasks (resume_with) WHERE resume_with IS NOT NULL;
