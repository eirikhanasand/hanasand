-- JSON-field selectivity otherwise makes the planner scan every capture
-- despite the much smaller exposure candidate index.
CREATE STATISTICS IF NOT EXISTS threat_intel.captures_exposure_fields_stats
  ON (record->'metadata'->'leakSite'->>'actorName'),
     (record->'metadata'->'leakSite'->>'victimName'),
     (record->>'title')
  FROM threat_intel.captures;
ANALYZE threat_intel.captures;
