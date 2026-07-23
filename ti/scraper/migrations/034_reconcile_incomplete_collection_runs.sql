WITH reconciled_at AS (
  SELECT clock_timestamp() AS value
),
incomplete AS (
  SELECT run.id
  FROM threat_intel.collection_runs run
  WHERE run.request_id = 'req_public_canary'
    AND run.status IN ('completed', 'degraded')
    AND run.task_count >
      CASE WHEN COALESCE(run.record->>'completedTaskCount', '') ~ '^\d+$'
        THEN (run.record->>'completedTaskCount')::integer ELSE 0 END
      + run.failed_task_count
)
UPDATE threat_intel.collection_runs run
SET status = 'failed',
    updated_at = reconciled_at.value,
    error = 'incomplete collection run reconciled: planned tasks did not reach a terminal state',
    record = run.record || jsonb_build_object(
      'status', 'failed',
      'updatedAt', reconciled_at.value,
      'error', 'incomplete collection run reconciled: planned tasks did not reach a terminal state',
      'sourceAccountingReconciledAt', reconciled_at.value
    )
FROM incomplete, reconciled_at
WHERE run.id = incomplete.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM threat_intel.collection_runs run
    WHERE run.request_id = 'req_public_canary'
      AND run.status IN ('completed', 'degraded')
      AND run.task_count >
        CASE WHEN COALESCE(run.record->>'completedTaskCount', '') ~ '^\d+$'
          THEN (run.record->>'completedTaskCount')::integer ELSE 0 END
        + run.failed_task_count
  ) THEN
    RAISE EXCEPTION 'incomplete collection-run reconciliation left a false terminal success';
  END IF;
END
$$;
