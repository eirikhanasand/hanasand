-- Keep the list/search projection beside the durable evidence; update it in the
-- same transaction so dashboards never need to scan full characterization data.
ALTER TABLE threat_intel.workflow_records ADD COLUMN IF NOT EXISTS actor_activity jsonb;
CREATE OR REPLACE FUNCTION threat_intel.refresh_actor_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.record_type = 'evidence_delta' AND NEW.record->>'subjectType' = 'actor_profile' THEN
    NEW.actor_activity := jsonb_build_object(
      'subjectId', NEW.record->'subjectId', 'sourceId', NEW.record->'sourceId',
      'kind', NEW.record->'kind', 'captureIds', NEW.record->'captureIds',
      'metadata', jsonb_build_object(
        'aliasesAdded', NEW.record#>'{metadata,aliasesAdded}',
        'characterization', (SELECT jsonb_object_agg(key, true) FROM jsonb_object_keys(COALESCE(NEW.record#>'{metadata,characterization}', '{}'::jsonb)) key),
        'wordsAdded', NEW.record#>'{metadata,wordsAdded}',
        'newFacts', NEW.record#>'{metadata,newFacts}'));
  ELSE
    NEW.actor_activity := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS actor_activity_projection ON threat_intel.workflow_records;
CREATE TRIGGER actor_activity_projection BEFORE INSERT OR UPDATE OF record, record_type
ON threat_intel.workflow_records FOR EACH ROW EXECUTE FUNCTION threat_intel.refresh_actor_activity();
UPDATE threat_intel.workflow_records SET record = record
WHERE record_type = 'evidence_delta' AND record->>'subjectType' = 'actor_profile' AND actor_activity IS NULL;
CREATE INDEX IF NOT EXISTS actor_activity_list_idx
ON threat_intel.workflow_records (tenant_id, updated_at DESC, id DESC) WHERE actor_activity IS NOT NULL;
ANALYZE threat_intel.workflow_records (actor_activity, tenant_id, record_type);
