-- One-time, explicitly requested cleanup. Retain records and audit history;
-- remove these test organizations from use without deleting their users.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE cleanup_organizations (id text PRIMARY KEY, expected_name text) ON COMMIT DROP;
INSERT INTO cleanup_organizations VALUES
('ec04a24a-7395-4c6c-85f6-a38d6aed5d2e', 'Commercial Acceptance mruaroxh'),
('19df09d0-6e0f-497e-a184-8fab2814b6e3', 'Commercial Acceptance mrubl4uc540203'),
('855e6bf0-2486-49e8-a770-bd7a8487d881', 'Commercial Acceptance mrubqqoob26670'),
('e7007ae0-41f5-4719-a5bb-da5b94cd365e', 'Commercial Acceptance mrubvyozcc136b'),
('c8a8145f-774a-43c9-bcc6-1ca488d39cde', 'Commercial Acceptance mruc4sgoc5e47e'),
('1a0ef2e9-4b0e-48e5-b35c-1f2953f9945b', 'Commercial Acceptance mrucjztgda76a9'),
('f74e8270-a189-4236-ad4b-f4b1320c71b6', 'Production Case Tenant msmplbm9');
SELECT o.id FROM organizations o JOIN cleanup_organizations c USING (id) FOR UPDATE OF o;
DO $$ BEGIN
    IF (SELECT count(*) FROM organizations o JOIN cleanup_organizations c ON c.id = o.id AND c.expected_name = o.name) <> 7 THEN
        RAISE EXCEPTION 'Expected test organizations changed; inspect before cleanup';
    END IF;
    IF EXISTS (SELECT 1 FROM vms WHERE organization_id IN (SELECT id FROM cleanup_organizations)) THEN
        RAISE EXCEPTION 'A test organization owns a VM; inspect before cleanup';
    END IF;
END $$;
INSERT INTO system_events (event_type, source, object_type, object_id, organization_id, reason, context)
SELECT 'organization.deleted', 'admin', 'organization', o.id, o.id,
    'User-requested removal of acceptance and production-case test tenants',
    jsonb_build_object('name', o.name, 'previousStatus', o.status, 'cleanup', 'remove-acceptance-tenants')
FROM organizations o JOIN cleanup_organizations c USING (id) WHERE o.status <> 'deleted';
UPDATE api_keys SET enabled = false, updated_at = NOW()
WHERE organization_id IN (SELECT id FROM cleanup_organizations) AND enabled;
UPDATE organization_members SET status = 'removed', removed_at = NOW()
WHERE organization_id IN (SELECT id FROM cleanup_organizations) AND status = 'active';
UPDATE organization_invites SET status = 'revoked', revoked_at = NOW()
WHERE organization_id IN (SELECT id FROM cleanup_organizations) AND status = 'pending';
UPDATE organization_watchlist_items SET status = 'archived', archived_at = NOW(), updated_at = NOW(),
    lifecycle_reason = 'User-requested test organization cleanup'
WHERE organization_id IN (SELECT id FROM cleanup_organizations) AND archived_at IS NULL;
UPDATE organizations SET status = 'deleted', default_webhook_policy = 'disabled', updated_at = NOW()
WHERE id IN (SELECT id FROM cleanup_organizations) AND status <> 'deleted';
COMMIT;
