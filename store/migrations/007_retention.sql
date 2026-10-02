-- The UTC day, as YYYY-MM-DD, on which a process last ran retention, so it
-- runs once a day whichever process opens the database first.
ALTER TABLE board ADD COLUMN retained_on TEXT;
