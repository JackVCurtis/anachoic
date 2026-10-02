-- A step you own may declare the artifact that marking it done requires, and
-- stores the artifact's URL when it is done.
ALTER TABLE steps ADD COLUMN output_format TEXT
  CHECK (output_format IN ('pull_request', 'ticket', 'document', 'link'));

ALTER TABLE steps ADD COLUMN artifact_url TEXT;
