-- A worker now asks with a form, stored as JSON in the question column. An
-- open question from before becomes a form of one text page, so it can still
-- be answered on the board.
UPDATE steps
SET question = json_object(
  'pages', json_array(json_object('id', 'q', 'question', question, 'choose', 'text'))
)
WHERE question IS NOT NULL;
