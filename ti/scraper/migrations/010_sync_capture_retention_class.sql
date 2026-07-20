UPDATE threat_intel.captures
SET retention_class = record->>'retentionClass'
WHERE record->>'retentionClass' IN (
  'public_raw', 'discovery_snippet', 'live_search_snapshot', 'evidence_delta',
  'public_report', 'public_chat_text', 'darknet_metadata', 'screenshot_hash',
  'sensitive_metadata', 'standard', 'short', 'restricted_metadata', 'legal_hold'
)
AND retention_class IS DISTINCT FROM record->>'retentionClass';
