import { createHash, randomUUID } from 'node:crypto'
import { queryOnce } from '#db'

export const ORGANIZATION_RETENTION_JOB_ID = 'api-organization-retention'
const BATCH_SIZE = 100
const MAX_ATTEMPTS = 5

type RetentionRun = {
    id: string
    organization_id: string
    privacy_request_id: string | null
    trigger_type: 'scheduled' | 'manual' | 'privacy_deletion'
    retention_days: number
    cutoff_at: Date | string
    attempt_count: number
}

type RetentionItem = {
    sourceService: 'hanasand-api' | 'ti-scraper'
    recordType: string
    recordId: string
    action: 'delete' | 'redact' | 'retain'
    status: 'deleted' | 'redacted' | 'protected' | 'failed' | 'retried'
    reason: string
    error?: string
}

export function organizationRetentionCutoff(retentionDays: number, now = new Date()) {
    return new Date(now.getTime() - retentionDays * 86_400_000).toISOString()
}

export async function queueOrganizationRetentionRun(input: {
    organizationId: string
    triggerType: 'manual' | 'privacy_deletion'
    requestedBy: string
    requestId: string
    privacyRequestId?: string
    retentionDays: number
}) {
    const cutoffAt = input.triggerType === 'privacy_deletion'
        ? new Date().toISOString()
        : organizationRetentionCutoff(input.retentionDays)
    const result = await queryOnce(`
        INSERT INTO organization_retention_runs (
            id, organization_id, privacy_request_id, trigger_type, retention_days,
            cutoff_at, requested_by, request_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING *
    `, [randomUUID(), input.organizationId, input.privacyRequestId ?? null, input.triggerType, input.triggerType === 'privacy_deletion' ? 0 : input.retentionDays, cutoffAt, input.requestedBy, input.requestId])
    if (result.rows[0]) return result.rows[0]
    const existing = await queryOnce(`
        SELECT * FROM organization_retention_runs
         WHERE organization_id = $1 AND trigger_type = $2 AND request_id = $3
         LIMIT 1
    `, [input.organizationId, input.triggerType, input.requestId])
    if (existing.rows[0]) return existing.rows[0]
    throw new Error('This organization already has an active retention or privacy run.')
}

export async function runOrganizationRetentionWorker(runId?: string) {
    await queryOnce(`
        UPDATE organization_retention_runs
           SET status = CASE WHEN attempt_count >= $1 THEN 'dead_letter' ELSE 'failed' END,
               error = 'Interrupted while running; queued for safe retry.',
               next_retry_at = CASE WHEN attempt_count >= $1 THEN NULL ELSE NOW() END, updated_at = NOW()
         WHERE status = 'running' AND updated_at < NOW() - INTERVAL '10 minutes'
    `, [MAX_ATTEMPTS])
    await queryOnce(`
        INSERT INTO organization_retention_runs (
            id, organization_id, trigger_type, retention_days, cutoff_at, run_date
        )
        SELECT gen_random_uuid()::text, id, 'scheduled', retention_days,
               NOW() - make_interval(days => retention_days), CURRENT_DATE
          FROM organizations
         WHERE status = 'active'
        ON CONFLICT DO NOTHING
    `)
    const claimed = await queryOnce(`
        WITH next_per_organization AS MATERIALIZED (
            SELECT DISTINCT ON (candidate.organization_id)
                   candidate.id, candidate.organization_id, candidate.attempt_count, candidate.updated_at, candidate.created_at
              FROM organization_retention_runs candidate
             WHERE (candidate.status = 'queued'
                OR (candidate.status = 'failed' AND candidate.next_retry_at IS NOT NULL AND candidate.next_retry_at <= NOW()))
               AND candidate.attempt_count < $2
               AND NOT EXISTS (
                    SELECT 1 FROM organization_retention_runs active
                     WHERE active.organization_id = candidate.organization_id
                       AND active.status = 'running' AND active.id <> candidate.id
               )
             ORDER BY candidate.organization_id, candidate.attempt_count, candidate.updated_at, candidate.created_at
        )
        UPDATE organization_retention_runs
           SET status = 'running', attempt_count = attempt_count + 1,
               started_at = COALESCE(started_at, NOW()), next_retry_at = NULL,
               error = NULL, updated_at = NOW()
         WHERE id = (
            SELECT run.id
              FROM organization_retention_runs run
              JOIN next_per_organization next ON next.id = run.id
             WHERE ($1::text IS NULL OR run.id = $1)
             ORDER BY next.attempt_count, next.updated_at, next.created_at
             FOR UPDATE OF run SKIP LOCKED
             LIMIT 1
         )
        RETURNING *
    `, [runId ?? null, MAX_ATTEMPTS])
    if (!claimed.rows[0]) return { claimed: false }
    return processRetentionRun(claimed.rows[0] as RetentionRun)
}

async function processRetentionRun(retentionRun: RetentionRun) {
    const mode = retentionRun.trigger_type === 'privacy_deletion' ? 'deletion' : 'scheduled'
    try {
        if (retentionRun.trigger_type === 'privacy_deletion') await beginPrivacyDeletion(retentionRun)
        const protectedInvites = await queryOnce('SELECT invite_id FROM admin_access_recovery_approvals WHERE organization_id = $1', [retentionRun.organization_id])
        const protectedProgress = await queryOnce(`
            SELECT COUNT(*)::int count
              FROM organization_retention_run_items
             WHERE run_id = $1 AND source_service = 'ti-scraper' AND status = 'protected'
        `, [retentionRun.id])
        const ti = await callTiPrivacy(retentionRun.organization_id, {
            action: 'purge',
            runId: retentionRun.id,
            cutoffAt: iso(retentionRun.cutoff_at),
            mode,
            limit: BATCH_SIZE,
            protectedOffset: Number(protectedProgress.rows[0]?.count ?? 0),
            protectedInviteIds: protectedInvites.rows.map(row => String(row.invite_id)),
        })
        await queryOnce(`
            UPDATE organization_retention_run_items
               SET status = 'retried', reason = 'privacy_runtime_recovered', error = NULL,
                   attempt_count = attempt_count + 1, processed_at = NOW()
             WHERE run_id = $1 AND source_service = 'ti-scraper'
               AND record_type = 'service' AND record_id = 'organization-privacy' AND status = 'failed'
        `, [retentionRun.id])
        const tiItems = [
            ...items(ti.completed),
            ...items(ti.failed),
            ...items(ti.protected),
        ]
        await saveRetentionItems(retentionRun, tiItems)

        const publicResult = await purgePublicOrganizationData(retentionRun, {
            limit: Math.max(0, BATCH_SIZE - Number(ti.processed ?? ti.selected ?? 0)),
            heldAlertIds: strings(ti.heldAlertIds),
            protectedWatchlistIds: strings(ti.protectedWatchlistIds),
        })
        const failed = tiItems.some(item => item.status === 'failed') || publicResult.failed
        const hasMore = Boolean(ti.hasMore) || publicResult.hasMore
        const deadLetter = failed && retentionRun.attempt_count >= MAX_ATTEMPTS
        const failureError = tiItems.find(item => item.status === 'failed')?.error || publicResult.error || 'One or more retained records failed.'
        if (!failed && !hasMore && retentionRun.trigger_type === 'privacy_deletion') {
            await completePrivacyDeletion(retentionRun, {
                heldAlertIds: strings(ti.heldAlertIds),
                protectedWatchlistIds: strings(ti.protectedWatchlistIds),
            })
        }
        await refreshRun(retentionRun, {
            status: deadLetter ? 'dead_letter' : failed ? 'failed' : hasMore ? 'queued' : 'completed',
            error: failed ? deadLetter ? `Retention failed after ${MAX_ATTEMPTS} attempts: ${failureError}` : `${failureError} The run will retry.` : null,
            result: {
                tenantId: retentionRun.organization_id,
                cutoffAt: iso(retentionRun.cutoff_at),
                mode,
                ti: { remainingEligible: ti.remainingEligible ?? 0, protection: ti.protection ?? {} },
                public: publicResult.summary,
                hasMore,
            },
        })
        return { claimed: true, runId: retentionRun.id, failed, hasMore: deadLetter ? false : hasMore, deadLetter }
    } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        await saveRetentionItems(retentionRun, [{
            sourceService: 'ti-scraper', recordType: 'service', recordId: 'organization-privacy',
            action: 'retain', status: 'failed', reason: 'privacy_runtime_unavailable', error: message,
        }])
        const deadLetter = retentionRun.attempt_count >= MAX_ATTEMPTS
        await refreshRun(retentionRun, {
            status: deadLetter ? 'dead_letter' : 'failed',
            error: deadLetter ? `Retention failed after ${MAX_ATTEMPTS} attempts: ${message}` : `${message} The run will retry.`,
            result: { tenantId: retentionRun.organization_id, retryable: !deadLetter, deadLetter },
        })
        return { claimed: true, runId: retentionRun.id, failed: true, hasMore: !deadLetter, deadLetter, error: message }
    }
}

async function purgePublicOrganizationData(retentionRun: RetentionRun, input: { limit: number, heldAlertIds: string[], protectedWatchlistIds: string[] }) {
    const deletion = retentionRun.trigger_type === 'privacy_deletion'
    const candidates = await publicCandidates(retentionRun, input, input.limit)
    let failed = false
    let firstError: string | undefined
    for (const candidate of candidates.rows as Array<{ record_type: string, record_id: string, action: 'delete' | 'redact' | 'retain', reason: string }>) {
        try {
            const item: RetentionItem = {
                sourceService: 'hanasand-api', recordType: candidate.record_type, recordId: candidate.record_id,
                action: candidate.action, status: candidate.action === 'retain' ? 'protected' : candidate.action === 'delete' ? 'deleted' : 'redacted',
                reason: candidate.reason,
            }
            if (candidate.action === 'retain') await saveRetentionItems(retentionRun, [item])
            else await mutateAndRecordPublicCandidate(retentionRun, candidate, input, item)
        } catch (caught) {
            failed = true
            firstError ??= caught instanceof Error ? caught.message : String(caught)
            await saveRetentionItems(retentionRun, [{
                sourceService: 'hanasand-api', recordType: candidate.record_type, recordId: candidate.record_id,
                action: candidate.action, status: 'failed', reason: candidate.reason,
                error: caught instanceof Error ? caught.message : String(caught),
            }])
        }
    }
    const remaining = await publicCandidates(retentionRun, input, 1)
    return {
        failed,
        error: firstError,
        hasMore: Number(remaining.rowCount) > 0,
        summary: { selected: Number(candidates.rowCount), deletion, remainingEligible: Number(remaining.rowCount) > 0 ? 'at_least_one' : 0 },
    }
}

function publicCandidates(retentionRun: RetentionRun, input: { heldAlertIds: string[], protectedWatchlistIds: string[] }, limit: number) {
    const deletion = retentionRun.trigger_type === 'privacy_deletion'
    return queryOnce(`
        WITH candidates AS (
            SELECT 'organization_invite' record_type, invite.id record_id, 'retain' action,
                   'access_recovery_evidence' reason, COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at, invite.created_at) occurred_at
              FROM organization_invites invite
             WHERE invite.organization_id = $1
               AND ($2::boolean OR ((invite.status IN ('accepted', 'revoked') OR (invite.status = 'pending' AND invite.expires_at <= $3)) AND COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at) <= $3))
               AND EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            UNION ALL
            SELECT 'organization_invite', invite.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at, invite.created_at)
              FROM organization_invites invite
             WHERE invite.organization_id = $1
               AND ($2::boolean OR ((invite.status IN ('accepted', 'revoked') OR (invite.status = 'pending' AND invite.expires_at <= $3)) AND COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at) <= $3))
               AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            UNION ALL
            SELECT 'organization_member', member.user_id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   member.removed_at
              FROM organization_members member
             WHERE member.organization_id = $1 AND member.status = 'removed'
               AND ($2::boolean OR member.removed_at <= $3)
            UNION ALL
            SELECT 'organization_watchlist_item', watchlist.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   watchlist.updated_at
              FROM organization_watchlist_items watchlist
             WHERE watchlist.organization_id = $1
               AND ($2::boolean OR (watchlist.status = 'archived' AND watchlist.archived_at <= $3))
               AND NOT (watchlist.id = ANY($4::text[]) OR ('org_' || watchlist.id) = ANY($4::text[]))
            UNION ALL
            SELECT 'dwm_webhook_destination', destination.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   destination.updated_at
              FROM dwm_webhook_destinations destination
             WHERE destination.org_id = $1
               AND ($2::boolean OR (destination.status = 'archived' AND destination.updated_at <= $3))
            UNION ALL
            SELECT 'dwm_webhook_delivery', delivery.id, 'redact',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'delivery_payload_retention_expired' END,
                   delivery.created_at
              FROM dwm_webhook_deliveries delivery
             WHERE delivery.org_id = $1 AND ($2::boolean OR delivery.created_at <= $3)
               AND NOT (delivery.alert_id = ANY($5::text[]))
               AND (delivery.payload <> '{}'::jsonb OR delivery.response_body IS NOT NULL OR delivery.error IS NOT NULL
                    OR delivery.endpoint_hint <> '' OR delivery.watchlist_name IS NOT NULL OR delivery.route IS NOT NULL OR delivery.case_path IS NOT NULL)
        )
        SELECT candidate.record_type, candidate.record_id, candidate.action, candidate.reason
          FROM candidates candidate
         WHERE NOT EXISTS (
            SELECT 1 FROM organization_retention_run_items item
             WHERE item.run_id = $6 AND item.source_service = 'hanasand-api'
               AND item.record_type = candidate.record_type AND item.record_id = candidate.record_id
               AND item.status <> 'failed'
         )
         ORDER BY candidate.occurred_at, candidate.record_type, candidate.record_id
         LIMIT $7
    `, [retentionRun.organization_id, deletion, iso(retentionRun.cutoff_at), input.protectedWatchlistIds, input.heldAlertIds, retentionRun.id, limit])
}

async function mutateAndRecordPublicCandidate(retentionRun: RetentionRun, candidate: { record_type: string, record_id: string, action: string, reason: string }, input: { heldAlertIds: string[], protectedWatchlistIds: string[] }, item: RetentionItem) {
    const params = [retentionRun.organization_id, candidate.record_id]
    if (candidate.record_type === 'organization_invite') {
        await mutateAndRecord('DELETE FROM organization_invites WHERE organization_id = $1 AND id = $2 AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals WHERE invite_id = $2) RETURNING id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'organization_watchlist_item') {
        await mutateAndRecord('DELETE FROM organization_watchlist_items WHERE organization_id = $1 AND id = $2 AND NOT (id = ANY($3::text[]) OR (\'org_\' || id) = ANY($3::text[])) RETURNING id', [...params, input.protectedWatchlistIds], retentionRun, item)
        return
    }
    if (candidate.record_type === 'organization_member') {
        await mutateAndRecord('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = \'removed\' RETURNING user_id AS id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'dwm_webhook_destination') {
        await mutateAndRecord('DELETE FROM dwm_webhook_destinations WHERE org_id = $1 AND id = $2 RETURNING id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'dwm_webhook_delivery') {
        await mutateAndRecord(`
            UPDATE dwm_webhook_deliveries
               SET endpoint_hint = '', endpoint_hash = '', payload = '{}'::jsonb,
                   response_body = NULL, error = NULL, error_class = NULL,
                   idempotency_key = 'privacy:' || id, watchlist_name = NULL,
                   route = NULL, case_path = NULL, next_retry_at = NULL, updated_at = NOW()
             WHERE org_id = $1 AND id = $2 AND NOT (alert_id = ANY($3::text[]))
             RETURNING id
        `, [...params, input.heldAlertIds], retentionRun, item)
        return
    }
    throw new Error(`Unsupported organization retention record type: ${candidate.record_type}`)
}

async function mutateAndRecord(mutation: string, mutationParams: Array<string | string[]>, retentionRun: RetentionRun, item: RetentionItem) {
    const offset = mutationParams.length
    const recorded = await queryOnce(`
        WITH mutated AS (${mutation})
        INSERT INTO organization_retention_run_items (
            run_id, organization_id, source_service, record_type, record_id,
            action, status, reason, error
        )
        SELECT $${offset + 1}, $${offset + 2}, 'hanasand-api', $${offset + 3}, mutated.id, $${offset + 4}, $${offset + 5}, $${offset + 6}, NULL
          FROM mutated
        ON CONFLICT (run_id, source_service, record_type, record_id)
        DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                      reason = EXCLUDED.reason, error = NULL,
                      attempt_count = organization_retention_run_items.attempt_count + 1,
                      processed_at = NOW()
        RETURNING record_id
    `, [...mutationParams, retentionRun.id, retentionRun.organization_id, item.recordType, item.action, item.status, item.reason])
    if (!recorded.rows[0]) throw new Error(`Eligible ${item.recordType} changed before the retention mutation; retrying safely.`)
}

async function saveRetentionItems(retentionRun: RetentionRun, retentionItems: RetentionItem[]) {
    for (const item of retentionItems) {
        await queryOnce(`
            INSERT INTO organization_retention_run_items (
                run_id, organization_id, source_service, record_type, record_id,
                action, status, reason, error
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (run_id, source_service, record_type, record_id)
            DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                          reason = EXCLUDED.reason, error = EXCLUDED.error,
                          attempt_count = organization_retention_run_items.attempt_count + 1,
                          processed_at = NOW()
        `, [retentionRun.id, retentionRun.organization_id, item.sourceService, item.recordType, item.recordId, item.action, item.status, item.reason, item.error ?? null])
    }
}

async function refreshRun(retentionRun: RetentionRun, input: { status: 'queued' | 'failed' | 'dead_letter' | 'completed', error: string | null, result: Record<string, unknown> }) {
    const retry = input.status === 'failed'
    const retryDelaySeconds = retry ? Math.min(3_600, 60 * 2 ** Math.max(0, retentionRun.attempt_count - 1)) : 0
    await queryOnce(`
        UPDATE organization_retention_runs run
           SET status = $2, error = $3, result = $4::jsonb,
               selected_count = counts.selected_count,
               protected_count = counts.protected_count,
               deleted_count = counts.deleted_count,
               redacted_count = counts.redacted_count,
               failed_count = counts.failed_count,
               retried_count = counts.retried_count,
               attempt_count = CASE WHEN $2 = 'queued' THEN 0 ELSE attempt_count END,
               next_retry_at = CASE WHEN $5::boolean THEN NOW() + ($6::int * INTERVAL '1 second') WHEN $2 = 'queued' THEN NOW() ELSE NULL END,
               completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
               updated_at = NOW()
          FROM (
            SELECT COUNT(*)::int selected_count,
                   COUNT(*) FILTER (WHERE status = 'protected')::int protected_count,
                   COUNT(*) FILTER (WHERE status = 'deleted')::int deleted_count,
                   COUNT(*) FILTER (WHERE status = 'redacted')::int redacted_count,
                   COUNT(*) FILTER (WHERE status = 'failed')::int failed_count,
                   COUNT(*) FILTER (WHERE status = 'retried')::int retried_count
              FROM organization_retention_run_items WHERE run_id = $1
          ) counts
         WHERE run.id = $1
    `, [retentionRun.id, input.status, input.error, JSON.stringify(input.result), retry, retryDelaySeconds])
    if (retentionRun.privacy_request_id) {
        await queryOnce(`
            UPDATE organization_privacy_requests
               SET status = CASE WHEN $2 = 'completed' THEN 'completed' WHEN $2 IN ('failed', 'dead_letter') THEN 'failed' ELSE 'running' END,
                   error = $3, result = $4::jsonb,
                   started_at = COALESCE(started_at, NOW()),
                   completed_at = CASE WHEN $2 IN ('completed', 'dead_letter') THEN NOW() ELSE NULL END,
                   retry_count = CASE WHEN $2 IN ('failed', 'dead_letter') THEN retry_count + 1 ELSE retry_count END,
                   updated_at = NOW()
             WHERE id = $1
        `, [retentionRun.privacy_request_id, input.status, input.error, JSON.stringify(input.result)])
    }
}

async function beginPrivacyDeletion(retentionRun: RetentionRun) {
    const locked = await queryOnce(`
        UPDATE organizations
           SET status = 'archived',
               audit_safe_metadata = audit_safe_metadata || jsonb_build_object(
                   'privacyDeletionRunId', $2::text,
                   'privacyDeletionPendingAt', COALESCE(audit_safe_metadata->'privacyDeletionPendingAt', to_jsonb(NOW()))
               ),
               updated_at = NOW()
         WHERE id = $1 AND status <> 'deleted'
           AND (NOT (audit_safe_metadata ? 'privacyDeletionRunId') OR audit_safe_metadata->>'privacyDeletionRunId' = $2)
         RETURNING id
    `, [retentionRun.organization_id, retentionRun.id])
    if (!locked.rows[0]) throw new Error('Organization is deleted or locked by another privacy deletion run.')
}

async function completePrivacyDeletion(retentionRun: RetentionRun, protection: { heldAlertIds: string[], protectedWatchlistIds: string[] }) {
    const completed = await queryOnce(`
        WITH locked_organization AS MATERIALIZED (
            SELECT id FROM organizations WHERE id = $1 FOR UPDATE
        ), deleted_members AS (
            DELETE FROM organization_members
             WHERE organization_id IN (SELECT id FROM locked_organization)
            RETURNING user_id
        ), deleted_invites AS (
            DELETE FROM organization_invites invite
             WHERE invite.organization_id IN (SELECT id FROM locked_organization)
               AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            RETURNING id
        ), deleted_watchlists AS (
            DELETE FROM organization_watchlist_items watchlist
             WHERE watchlist.organization_id IN (SELECT id FROM locked_organization)
               AND NOT (watchlist.id = ANY($3::text[]) OR ('org_' || watchlist.id) = ANY($3::text[]))
            RETURNING id
        ), deleted_destinations AS (
            DELETE FROM dwm_webhook_destinations destination
             WHERE destination.org_id IN (SELECT id FROM locked_organization)
            RETURNING id
        ), redacted_deliveries AS (
            UPDATE dwm_webhook_deliveries delivery
               SET endpoint_hint = '', endpoint_hash = '', payload = '{}'::jsonb,
                   response_body = NULL, error = NULL, error_class = NULL,
                   idempotency_key = 'privacy:' || delivery.id, watchlist_name = NULL,
                   route = NULL, case_path = NULL, next_retry_at = NULL, updated_at = NOW()
             WHERE delivery.org_id IN (SELECT id FROM locked_organization)
               AND NOT (delivery.alert_id = ANY($4::text[]))
               AND (delivery.payload <> '{}'::jsonb OR delivery.response_body IS NOT NULL OR delivery.error IS NOT NULL
                    OR delivery.endpoint_hint <> '' OR delivery.watchlist_name IS NOT NULL OR delivery.route IS NOT NULL OR delivery.case_path IS NOT NULL)
            RETURNING id
        ), redacted_admin_audit AS (
            UPDATE admin_audit_events event
               SET actor_id = NULL, target_id = NULL, entity_id = NULL, request_id = NULL,
                   reason = '', context = jsonb_build_object('privacyDeletionRunId', $2::text),
                   ip = '', user_agent = ''
             WHERE event.organization_id IN (SELECT id FROM locked_organization)
               AND (event.actor_id IS NOT NULL OR event.target_id IS NOT NULL OR event.entity_id IS NOT NULL
                    OR event.request_id IS NOT NULL OR event.reason <> '' OR event.context <> '{}'::jsonb
                    OR event.ip <> '' OR event.user_agent <> '')
            RETURNING id::text id
        ), redacted_webhook_audit AS (
            UPDATE dwm_webhook_audit_events event
               SET owner_id = NULL, actor_id = NULL,
                   metadata = jsonb_build_object('privacyDeletionRunId', $2::text)
             WHERE event.org_id IN (SELECT id FROM locked_organization)
               AND (event.owner_id IS NOT NULL OR event.actor_id IS NOT NULL
                    OR event.metadata <> jsonb_build_object('privacyDeletionRunId', $2::text))
            RETURNING id
        ), redacted_service_logs AS (
            UPDATE service_logs event
               SET service = 'hanasand-api', host = '', level = 'info',
                   message = COALESCE(NULLIF(event.metadata->>'action', ''), 'organization_event'),
                   metadata = jsonb_strip_nulls(jsonb_build_object(
                       'category', event.metadata->>'category',
                       'action', event.metadata->>'action',
                       'organizationId', $1::text,
                       'tenantId', $1::text,
                       'outcome', event.metadata->>'outcome',
                       'privacyDeletionRunId', $2::text
                   ))
             WHERE event.metadata->>'organizationId' = $1
                OR event.metadata->>'tenantId' = $1
            RETURNING id::text id
        ), affected AS (
            SELECT 'organization_member' record_type, user_id record_id, 'delete' action, 'deleted' status FROM deleted_members
            UNION ALL SELECT 'organization_invite', id, 'delete', 'deleted' FROM deleted_invites
            UNION ALL SELECT 'organization_watchlist_item', id, 'delete', 'deleted' FROM deleted_watchlists
            UNION ALL SELECT 'dwm_webhook_destination', id, 'delete', 'deleted' FROM deleted_destinations
            UNION ALL SELECT 'dwm_webhook_delivery', id, 'redact', 'redacted' FROM redacted_deliveries
            UNION ALL SELECT 'admin_audit_event', id, 'redact', 'redacted' FROM redacted_admin_audit
            UNION ALL SELECT 'dwm_webhook_audit_event', id, 'redact', 'redacted' FROM redacted_webhook_audit
            UNION ALL SELECT 'service_log', id, 'redact', 'redacted' FROM redacted_service_logs
        ), recorded AS (
            INSERT INTO organization_retention_run_items (
                run_id, organization_id, source_service, record_type, record_id,
                action, status, reason
            )
            SELECT $2, $1, 'hanasand-api', record_type, record_id,
                   action, status, 'organization_privacy_deletion'
              FROM affected
            ON CONFLICT (run_id, source_service, record_type, record_id)
            DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                          reason = EXCLUDED.reason, error = NULL,
                          attempt_count = organization_retention_run_items.attempt_count + 1,
                          processed_at = NOW()
        )
        UPDATE organizations
           SET name = 'Deleted organization', slug = 'deleted-' || id,
               created_by = NULL, status = 'deleted',
               default_webhook_policy = 'disabled', alert_visibility_policy = 'owners',
               retention_days = 30,
               audit_safe_metadata = jsonb_build_object(
                   'privacyDeletedAt', NOW(),
                   'privacyDeletionRunId', $2::text
               ),
               updated_at = NOW()
         WHERE id IN (SELECT id FROM locked_organization)
         RETURNING id
    `, [retentionRun.organization_id, retentionRun.id, protection.protectedWatchlistIds, protection.heldAlertIds])
    if (!completed.rows[0]) throw new Error('Organization disappeared before privacy deletion could be finalized.')
}

export async function organizationPrivacyState(organizationId: string, page = { itemOffset: 0, itemLimit: 100 }) {
    const [organization, runs, requests, retentionItems, counts] = await Promise.all([
        queryOnce('SELECT id, name, status, retention_days, updated_at FROM organizations WHERE id = $1', [organizationId]),
        queryOnce('SELECT * FROM organization_retention_runs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 20', [organizationId]),
        queryOnce('SELECT * FROM organization_privacy_requests WHERE organization_id = $1 ORDER BY requested_at DESC LIMIT 20', [organizationId]),
        queryOnce(`
            SELECT item.*
              FROM organization_retention_run_items item
              JOIN organization_retention_runs run ON run.id = item.run_id
             WHERE item.organization_id = $1
             ORDER BY run.created_at DESC, item.processed_at DESC
             LIMIT $2 OFFSET $3
        `, [organizationId, page.itemLimit, page.itemOffset]),
        queryOnce(`
            SELECT
              (SELECT COUNT(*)::int FROM organization_retention_run_items WHERE organization_id = $1 AND status = 'protected') protected_events,
              (SELECT COUNT(*)::int FROM organization_retention_run_items WHERE organization_id = $1) total_retention_items,
              (SELECT COUNT(*)::int FROM admin_access_recovery_approvals WHERE organization_id = $1) access_recovery_holds,
              (SELECT COUNT(*)::int FROM admin_audit_events WHERE organization_id = $1) immutable_admin_audit_events,
              (SELECT COUNT(*)::int FROM dwm_webhook_audit_events WHERE org_id = $1) immutable_webhook_audit_events,
              (SELECT COUNT(*)::int FROM service_logs WHERE metadata->>'organizationId' = $1 OR metadata->>'tenantId' = $1) immutable_service_logs
        `, [organizationId]),
    ])
    return {
        schemaVersion: 'organization.privacy_state.v1',
        organization: organization.rows[0],
        runs: runs.rows,
        requests: requests.rows,
        items: retentionItems.rows,
        itemPage: {
            offset: page.itemOffset,
            limit: page.itemLimit,
            nextOffset: page.itemOffset + retentionItems.rows.length < Number(counts.rows[0]?.total_retention_items ?? 0) ? page.itemOffset + retentionItems.rows.length : null,
        },
        protection: {
            ...counts.rows[0],
            explanation: 'Legal holds and access-recovery evidence remain protected. Immutable audit references are retained; non-held customer configuration, payloads, identifiers, notes, owners, and event content are deleted or privacy-redacted.',
        },
    }
}

export async function exportOrganizationPrivacyData(organizationId: string) {
    const [publicData, ti] = await Promise.all([
        queryOnce(`
            SELECT to_jsonb(organization) organization,
                   COALESCE((SELECT jsonb_agg(member ORDER BY member.created_at) FROM organization_members member WHERE member.organization_id = organization.id), '[]'::jsonb) members,
                   COALESCE((SELECT jsonb_agg(invite ORDER BY invite.created_at) FROM organization_invites invite WHERE invite.organization_id = organization.id), '[]'::jsonb) invites,
                   COALESCE((SELECT jsonb_agg(watchlist ORDER BY watchlist.created_at) FROM organization_watchlist_items watchlist WHERE watchlist.organization_id = organization.id), '[]'::jsonb) watchlists,
                   COALESCE((SELECT jsonb_agg(jsonb_build_object('id', destination.id, 'name', destination.name, 'kind', destination.kind, 'endpointHint', destination.endpoint_hint, 'status', destination.status, 'events', destination.events, 'createdAt', destination.created_at, 'updatedAt', destination.updated_at) ORDER BY destination.created_at) FROM dwm_webhook_destinations destination WHERE destination.org_id = organization.id), '[]'::jsonb) webhook_destinations,
                   COALESCE((SELECT jsonb_agg(delivery ORDER BY delivery.created_at) FROM dwm_webhook_deliveries delivery WHERE delivery.org_id = organization.id), '[]'::jsonb) webhook_deliveries
                   , COALESCE((SELECT jsonb_agg(request ORDER BY request.requested_at) FROM organization_privacy_requests request WHERE request.organization_id = organization.id), '[]'::jsonb) privacy_requests
                   , COALESCE((SELECT jsonb_agg(run ORDER BY run.created_at) FROM organization_retention_runs run WHERE run.organization_id = organization.id), '[]'::jsonb) retention_runs
                   , COALESCE((SELECT jsonb_agg(item ORDER BY item.processed_at) FROM organization_retention_run_items item WHERE item.organization_id = organization.id), '[]'::jsonb) retention_items
                   , COALESCE((SELECT jsonb_agg(approval ORDER BY approval.created_at) FROM admin_access_recovery_approvals approval WHERE approval.organization_id = organization.id), '[]'::jsonb) access_recovery_evidence
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.created_at) FROM admin_audit_events event WHERE event.organization_id = organization.id), '[]'::jsonb) admin_audit_events
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.created_at) FROM dwm_webhook_audit_events event WHERE event.org_id = organization.id), '[]'::jsonb) webhook_audit_events
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.created_at) FROM service_logs event WHERE event.metadata->>'organizationId' = organization.id OR event.metadata->>'tenantId' = organization.id), '[]'::jsonb) service_logs
              FROM organizations organization WHERE organization.id = $1
        `, [organizationId]),
        callTiPrivacy(organizationId),
    ])
    if (!publicData.rows[0]) throw new Error('Organization not found')
    const exportedAt = new Date().toISOString()
    const data = { public: publicData.rows[0], threatIntelligence: ti }
    return {
        schemaVersion: 'organization.privacy_export.v1', organizationId, tenantId: organizationId, exportedAt, data,
        checksum: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    }
}

async function callTiPrivacy(organizationId: string, body?: Record<string, unknown>) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) throw new Error('Threat-intelligence privacy runtime is not configured')
    const response = await fetch(`${base}/v1/organizations/${encodeURIComponent(organizationId)}/privacy`, {
        method: body ? 'POST' : 'GET',
        headers: {
            accept: 'application/json',
            'x-hanasand-service-token': token,
            'x-organization-id': organizationId,
            'x-tenant-id': organizationId,
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => null) as any
    if (!response.ok && !(payload?.schemaVersion === 'organization.privacy_purge.ti.v1' && Array.isArray(payload.failed))) {
        throw new Error(payload?.error?.message || payload?.error || `Threat-intelligence privacy runtime returned ${response.status}`)
    }
    if (!payload) throw new Error('Threat-intelligence privacy runtime returned no data')
    return payload
}

function items(value: unknown): RetentionItem[] {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RetentionItem[] : []
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : []
}

function iso(value: Date | string) {
    return new Date(value).toISOString()
}
