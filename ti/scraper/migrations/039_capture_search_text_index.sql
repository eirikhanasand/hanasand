CREATE INDEX IF NOT EXISTS captures_record_search_text_idx
  ON threat_intel.captures
  USING GIN (to_tsvector('simple', record::text));
