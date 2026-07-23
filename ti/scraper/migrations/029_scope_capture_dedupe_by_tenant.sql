DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_text_published_uq;
DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_content_published_uq;

CREATE INDEX IF NOT EXISTS threat_intel_captures_source_text_published_lookup_idx
  ON threat_intel.captures (
    COALESCE(tenant_id, ''),
    COALESCE(record #>> '{metadata,organizationId}', ''),
    source_id,
    normalized_text_hash,
    COALESCE(published_at, '-infinity'::timestamptz)
  )
  WHERE normalized_text_hash IS NOT NULL
    AND published_at IS NULL;

DROP TRIGGER IF EXISTS threat_intel_captures_reject_duplicate_text ON threat_intel.captures;
DROP FUNCTION IF EXISTS threat_intel.reject_duplicate_capture_text();

CREATE OR REPLACE FUNCTION threat_intel.reject_duplicate_capture_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  key_changed boolean := true;
BEGIN
  IF NEW.normalized_text_hash IS NULL OR NEW.published_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    key_changed := ROW(
      COALESCE(NEW.tenant_id, ''),
      COALESCE(NEW.record #>> '{metadata,organizationId}', ''),
      NEW.source_id,
      NEW.normalized_text_hash,
      NEW.published_at
    ) IS DISTINCT FROM ROW(
      COALESCE(OLD.tenant_id, ''),
      COALESCE(OLD.record #>> '{metadata,organizationId}', ''),
      OLD.source_id,
      OLD.normalized_text_hash,
      OLD.published_at
    );
  END IF;
  IF NOT key_changed THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(
    E'\x1f',
    COALESCE(NEW.tenant_id, ''),
    COALESCE(NEW.record #>> '{metadata,organizationId}', ''),
    NEW.source_id,
    NEW.normalized_text_hash
  ), 0));

  IF EXISTS (
    SELECT 1
    FROM threat_intel.captures AS capture
    WHERE COALESCE(capture.tenant_id, '') = COALESCE(NEW.tenant_id, '')
      AND COALESCE(capture.record #>> '{metadata,organizationId}', '') = COALESCE(NEW.record #>> '{metadata,organizationId}', '')
      AND capture.source_id = NEW.source_id
      AND capture.normalized_text_hash = NEW.normalized_text_hash
      AND capture.published_at IS NULL
      AND capture.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'duplicate scoped capture text'
      USING ERRCODE = '23505',
            CONSTRAINT = 'threat_intel_captures_source_text_published_uq';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER threat_intel_captures_reject_duplicate_text
  BEFORE INSERT OR UPDATE OF tenant_id, source_id, normalized_text_hash, published_at, record
  ON threat_intel.captures
  FOR EACH ROW
  EXECUTE FUNCTION threat_intel.reject_duplicate_capture_text();

CREATE UNIQUE INDEX threat_intel_captures_source_text_published_uq
  ON threat_intel.captures (
    COALESCE(tenant_id, ''),
    COALESCE(record #>> '{metadata,organizationId}', ''),
    source_id,
    normalized_text_hash,
    COALESCE(published_at, '-infinity'::timestamptz)
  )
  WHERE normalized_text_hash IS NOT NULL
    AND published_at IS NOT NULL;

CREATE UNIQUE INDEX threat_intel_captures_source_content_published_uq
  ON threat_intel.captures (
    COALESCE(tenant_id, ''),
    COALESCE(record #>> '{metadata,organizationId}', ''),
    source_id,
    content_hash,
    COALESCE(published_at, '-infinity'::timestamptz)
  );
