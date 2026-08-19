DROP TRIGGER IF EXISTS threat_intel_captures_reject_duplicate_text ON threat_intel.captures;
DROP FUNCTION IF EXISTS threat_intel.reject_duplicate_capture_text();

CREATE OR REPLACE FUNCTION threat_intel.reject_duplicate_capture_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.normalized_text_hash IS NULL OR NEW.published_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND ROW(
    COALESCE(NEW.tenant_id, ''), NEW.source_id, NEW.normalized_text_hash, NEW.published_at
  ) IS NOT DISTINCT FROM ROW(
    COALESCE(OLD.tenant_id, ''), OLD.source_id, OLD.normalized_text_hash, OLD.published_at
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(
    E'\\x1f', COALESCE(NEW.tenant_id, ''), NEW.source_id, NEW.normalized_text_hash
  ), 0));

  IF EXISTS (
    SELECT 1
    FROM threat_intel.captures AS capture
    WHERE COALESCE(capture.tenant_id, '') = COALESCE(NEW.tenant_id, '')
      AND capture.source_id = NEW.source_id
      AND capture.normalized_text_hash = NEW.normalized_text_hash
      AND capture.published_at IS NULL
      AND capture.id <> NEW.id
  ) THEN
    -- Returning NULL skips the duplicate row without aborting the surrounding write transaction.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER threat_intel_captures_reject_duplicate_text
  BEFORE INSERT OR UPDATE OF tenant_id, source_id, normalized_text_hash, published_at, record
  ON threat_intel.captures
  FOR EACH ROW
  EXECUTE FUNCTION threat_intel.reject_duplicate_capture_text();
