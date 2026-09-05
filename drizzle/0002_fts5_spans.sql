CREATE VIRTUAL TABLE IF NOT EXISTS spans_fts USING fts5(
  span_id UNINDEXED,
  run_id UNINDEXED,
  convo_id UNINDEXED,
  span_name,
  span_type,
  model,
  content_text,
  tokenize = 'porter unicode61 remove_diacritics 2'
);