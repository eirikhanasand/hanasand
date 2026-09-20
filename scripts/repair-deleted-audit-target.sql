-- Recover only the two reported targets from the retained successful request.
-- Preserve the original null object_id and record where the added identity came from.
BEGIN;
UPDATE system_events event
SET context = event.context || jsonb_build_object(
    'targetId', 'closure_acceptance_20260723',
    'targetSource', 'Request log: DELETE /api/user/closure_acceptance_20260723'
)
WHERE event.id IN (38315, 38316)
  AND event.request_id = '42c33313-7ab3-41df-b5c9-d5cbce4e7bcc'
  AND event.event_type IN ('admin.account.deleted', 'user.account.deleted')
  AND event.object_id IS NULL
  AND event.actor_id = 'eirikhanasand'
  AND NOT (event.context ? 'targetId')
  AND EXISTS (
      SELECT 1 FROM traffic_events traffic
      WHERE traffic.path = '/api/user/closure_acceptance_20260723'
        AND traffic.method = 'DELETE' AND traffic.status = 200
        AND traffic.ip = event.ip
        AND traffic.created_at BETWEEN event.created_at AND event.created_at + INTERVAL '1 second'
  );
COMMIT;
