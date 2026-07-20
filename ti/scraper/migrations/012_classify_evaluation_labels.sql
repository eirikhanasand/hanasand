UPDATE threat_intel.evaluation_labels
SET record = record || '{"labelingMethod":"source_field_parity","independentFromExtractor":false}'::jsonb
WHERE labeled_by = 'cisa-kev-authoritative-v1';

UPDATE threat_intel.evaluation_labels
SET record = record || '{"labelingMethod":"cross_source_corroboration","independentFromExtractor":false}'::jsonb
WHERE labeled_by = 'cross-source-corroboration-v1';

UPDATE threat_intel.evaluation_labels
SET record = record || '{"labelingMethod":"manual_source_review","independentFromExtractor":true}'::jsonb
WHERE labeled_by = 'thesis-evaluation-audit';
