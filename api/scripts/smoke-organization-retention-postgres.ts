import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import Fastify from 'fastify'
import ingestLog from '../src/handlers/logs/ingest.ts'
import { postOrganizationPrivacy } from '../src/handlers/organizationPrivacy.ts'
import { putOrganizationSettings } from '../src/handlers/organizations.ts'
import { queryOnce } from '../src/utils/db.ts'
import ensureSchema from '../src/utils/db/ensureSchema.ts'
import recordLog from '../src/utils/logs/recordLog.ts'
import {
    exportOrganizationPrivacyData,
    organizationPrivacyState,
    queueOrganizationRetentionRun,
    runOrganizationRetentionWorker,
} from '../src/utils/organizationPrivacy.ts'

assert.equal(process.env.DB, 'hanasand_retention_test', 'Refusing to run outside the disposable retention test database.')
await ensureSchema()

const old = '2020-01-01T00:00:00.000Z'
const currentPassword = 'retention-owner-password'
const users = [
    'retention_user_a', 'retention_user_b', 'retention_user_c', 'retention_user_removed',
    'retention_user_recovered', 'retention_user_poison', 'retention_user_fair',
    'retention_user_page', 'retention_user_concurrent', 'retention_user_auth_owner', 'retention_user_auth_admin',
    'retention_user_page_a', 'retention_user_page_b', 'retention_user_locked',
]
for (const user of users) {
    await queryOnce('INSERT INTO users (id, name, password, avatar) VALUES ($1, $1, $2, $3)', [user, user === 'retention_user_auth_owner' ? await bcrypt.hash(currentPassword, 4) : 'local-test', ''])
}
for (const [id, user, name, slug] of [
    ['retention_org_a', users[0], 'Retention Customer A', 'retention-customer-a'],
    ['retention_org_b', users[1], 'Retention Customer B', 'retention-customer-b'],
    ['retention_org_c', users[2], 'Sensitive Customer C', 'sensitive-customer-c'],
    ['retention_org_recovered', users[4], 'Recovered Runtime', 'recovered-runtime'],
    ['retention_org_poison', users[5], 'Missing Mirror', 'missing-mirror'],
    ['retention_org_fair', users[6], 'Fair Tenant', 'fair-tenant'],
    ['retention_org_page', users[7], 'Protected Pages', 'protected-pages'],
    ['retention_org_concurrent', users[8], 'Concurrent Tenant', 'concurrent-tenant'],
    ['retention_org_auth', users[9], 'Authenticated Deletion', 'authenticated-deletion'],
    ['retention_org_page_a', users[11], 'Paged Tenant A', 'paged-tenant-a'],
    ['retention_org_page_b', users[12], 'Paged Tenant B', 'paged-tenant-b'],
    ['retention_org_locked', users[13], 'Locked Tenant', 'locked-tenant'],
]) {
    await queryOnce('INSERT INTO organizations (id, name, slug, status, retention_days, created_by) VALUES ($1, $3, $4, \'archived\', 30, $2)', [id, user, name, slug])
    await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at) VALUES ($1, $2, \'owner\', \'active\', $3)', [id, user, old])
}
await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at, removed_at) VALUES (\'retention_org_a\', $1, \'member\', \'removed\', NOW(), $2)', [users[3], old])
await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at) VALUES (\'retention_org_auth\', $1, \'admin\', \'active\', $2)', [users[10], old])
await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent) VALUES
        ($1, 'retention-owner-token', '127.0.0.1', 'retention-smoke'),
        ($2, 'retention-admin-token', '127.0.0.1', 'retention-smoke'),
        ($3, 'retention-poison-token', '127.0.0.1', 'retention-smoke'),
        ($4, 'retention-locked-token', '127.0.0.1', 'retention-smoke')
`, [users[9], users[10], users[5], users[13]])

await queryOnce('INSERT INTO organization_invites (id, organization_id, email, invited_by, status, created_at, expires_at, revoked_at) VALUES (\'invite_delete\', \'retention_org_a\', \'delete@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2), (\'invite_hold\', \'retention_org_a\', \'hold@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2), (\'invite_other\', \'retention_org_b\', \'other@example.test\', $3, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2)', [users[0], old, users[1]])
await queryOnce('INSERT INTO admin_access_recovery_approvals (request_id, organization_id, invite_id, requested_by, expires_at) VALUES (\'recovery_hold\', \'retention_org_a\', \'invite_hold\', $1, NOW() + INTERVAL \'1 day\')', [users[0]])
await queryOnce('INSERT INTO organization_invites (id, organization_id, email, invited_by, status, created_at, expires_at, revoked_at) VALUES (\'invite_delete_hold\', \'retention_org_c\', \'held-customer@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2)', [users[2], old])
await queryOnce('INSERT INTO admin_access_recovery_approvals (request_id, organization_id, invite_id, requested_by, expires_at) VALUES (\'recovery_delete_hold\', \'retention_org_c\', \'invite_delete_hold\', $1, NOW() + INTERVAL \'1 day\')', [users[2]])
await queryOnce('INSERT INTO organization_watchlist_items (id, organization_id, kind, value, status, created_by, created_at, updated_at, archived_at) VALUES (\'watch_delete\', \'retention_org_a\', \'domain\', \'delete.example\', \'archived\', $1, $3, $3, $3), (\'watch_hold\', \'retention_org_a\', \'domain\', \'hold.example\', \'archived\', $1, $3, $3, $3), (\'watch_other\', \'retention_org_b\', \'domain\', \'other.example\', \'archived\', $2, $3, $3, $3)', [users[0], users[1], old])
await queryOnce('INSERT INTO dwm_webhook_deliveries (id, owner_id, org_id, alert_id, event_type, status, dry_run, payload, idempotency_key, created_at, updated_at) VALUES (\'delivery_delete\', $1, \'retention_org_a\', \'alert_delete\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"delete"}\', \'delivery-delete\', $4, $4), (\'delivery_hold\', $1, \'retention_org_a\', \'alert_hold\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"hold"}\', \'delivery-hold\', $4, $4), (\'delivery_other\', $2, \'retention_org_b\', \'alert_other\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"other"}\', \'delivery-other\', $4, $4), (\'delivery_retry\', $3, \'retention_org_c\', \'alert_retry\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"retry"}\', \'delivery-retry\', $4, $4)', [users[0], users[1], users[2], old])

const tiModes = new Map<string, 'missing' | 'record-failure'>()
const tiPages = new Map<string, number>()
globalThis.fetch = async(input, init) => {
    const url = new URL(String(input))
    const organizationId = decodeURIComponent(url.pathname.split('/')[3])
    if ((init?.method || 'GET') === 'GET') {
        return Response.json({ schemaVersion: 'organization.privacy_export.ti.v1', organizationId, tenantId: organizationId, data: { marker: organizationId } })
    }
    if (tiModes.get(organizationId) === 'missing') {
        return Response.json({ error: { message: 'Organization mirror not found' } }, { status: 404 })
    }
    if (tiModes.get(organizationId) === 'record-failure') {
        return Response.json({
            schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 1,
            completed: [], protected: [], failed: [{ sourceService: 'ti-scraper', recordType: 'capture', recordId: 'capture_retry', action: 'redact', status: 'failed', reason: 'object_store_unavailable', error: 'retry me' }],
            heldAlertIds: [], protectedWatchlistIds: [], hasMore: true, remainingEligible: 1,
        }, { status: 503 })
    }
    if (organizationId === 'retention_org_page_a') {
        const page = (tiPages.get(organizationId) || 0) + 1
        tiPages.set(organizationId, page)
        const completed = Array.from({ length: 100 }, (_, index) => ({
            sourceService: 'ti-scraper', recordType: 'capture', recordId: `page-${page}-${index}`,
            action: 'redact', status: 'redacted', reason: 'organization_retention_expired',
        }))
        return Response.json({
            schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 100, processed: 100,
            completed, protected: [], failed: [], heldAlertIds: [], protectedWatchlistIds: [],
            hasMore: page < 3, remainingEligible: page < 3 ? 100 : 0,
        })
    }
    return Response.json({
        schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 0,
        completed: organizationId === 'retention_org_c' ? [{ sourceService: 'ti-scraper', recordType: 'capture', recordId: 'capture_retry', action: 'redact', status: 'redacted', reason: 'organization_retention_expired' }] : [],
        protected: [], failed: [],
        heldAlertIds: organizationId === 'retention_org_a' ? ['alert_hold'] : [],
        protectedWatchlistIds: organizationId === 'retention_org_a' ? ['org_watch_hold'] : [],
        hasMore: false, remainingEligible: 0,
    })
}

const runA = await queueOrganizationRetentionRun({ organizationId: 'retention_org_a', triggerType: 'manual', requestedBy: users[0], requestId: randomUUID(), retentionDays: 30 })
assert.deepEqual(await runOrganizationRetentionWorker(runA.id), { claimed: true, runId: runA.id, failed: false, hasMore: false, deadLetter: false })
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_delete\'')).rows[0].count, 0)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_hold\'')).rows[0].count, 1)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_watchlist_items WHERE id = \'watch_delete\'')).rows[0].count, 0)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_watchlist_items WHERE id = \'watch_hold\'')).rows[0].count, 1)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_a\' AND user_id = $1', [users[3]])).rows[0].count, 0)
assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_delete\'')).rows[0].payload, {})
assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_hold\'')).rows[0].payload, { secret: 'hold' })
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_other\'')).rows[0].count, 1)
assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_other\'')).rows[0].payload, { secret: 'other' })
assert.equal((await runOrganizationRetentionWorker(runA.id)).claimed, false)

const exported = await exportOrganizationPrivacyData('retention_org_a')
assert.equal((exported.data.public.organization as { id: string }).id, 'retention_org_a')
assert.equal((exported.data.threatIntelligence as { organizationId: string }).organizationId, 'retention_org_a')
assert.deepEqual(Object.keys(exported.data.public).sort(), [
    'access_recovery_evidence', 'admin_audit_events', 'invites', 'members', 'organization',
    'privacy_requests', 'retention_items', 'retention_runs', 'service_logs', 'watchlists',
    'webhook_audit_events', 'webhook_deliveries', 'webhook_destinations',
])

const interrupted = await queueOrganizationRetentionRun({ organizationId: 'retention_org_b', triggerType: 'manual', requestedBy: users[1], requestId: randomUUID(), retentionDays: 30 })
await queryOnce('UPDATE organization_retention_runs SET status = \'running\', updated_at = NOW() - INTERVAL \'20 minutes\' WHERE id = $1', [interrupted.id])
assert.equal((await runOrganizationRetentionWorker(interrupted.id)).failed, false)
assert.equal((await queryOnce('SELECT attempt_count FROM organization_retention_runs WHERE id = $1', [interrupted.id])).rows[0].attempt_count, 1)

tiModes.set('retention_org_c', 'record-failure')
const retryRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_c', triggerType: 'manual', requestedBy: users[2], requestId: randomUUID(), retentionDays: 30 })
assert.equal((await runOrganizationRetentionWorker(retryRun.id)).failed, true)
tiModes.delete('retention_org_c')
await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [retryRun.id])
assert.equal((await runOrganizationRetentionWorker(retryRun.id)).failed, false)
assert.equal((await queryOnce('SELECT status FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'capture\' AND record_id = \'capture_retry\'', [retryRun.id])).rows[0].status, 'redacted')

tiModes.set('retention_org_recovered', 'missing')
const recoveredRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_recovered', triggerType: 'manual', requestedBy: users[4], requestId: randomUUID(), retentionDays: 30 })
assert.equal((await runOrganizationRetentionWorker(recoveredRun.id)).failed, true)
const recoveredRetry = (await queryOnce('SELECT attempt_count, EXTRACT(EPOCH FROM (next_retry_at - NOW()))::int retry_delay FROM organization_retention_runs WHERE id = $1', [recoveredRun.id])).rows[0]
assert.equal(recoveredRetry.attempt_count, 1)
assert.equal(recoveredRetry.retry_delay >= 55 && recoveredRetry.retry_delay <= 60, true)
tiModes.delete('retention_org_recovered')
await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [recoveredRun.id])
assert.equal((await runOrganizationRetentionWorker(recoveredRun.id)).failed, false)
assert.equal((await queryOnce('SELECT status FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'service\'', [recoveredRun.id])).rows[0].status, 'retried')
assert.equal((await queryOnce('SELECT protected_count FROM organization_retention_runs WHERE id = $1', [recoveredRun.id])).rows[0].protected_count, 0)

const pageARun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_page_a', triggerType: 'manual', requestedBy: users[11], requestId: randomUUID(), retentionDays: 30 })
const pageBRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_page_b', triggerType: 'manual', requestedBy: users[12], requestId: randomUUID(), retentionDays: 30 })
assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, true)
const yieldedTenant = await runOrganizationRetentionWorker()
assert.equal(yieldedTenant.runId, pageBRun.id, 'a yielded multi-page tenant must not starve a later tenant')
assert.equal(tiPages.get('retention_org_page_a'), 1)
assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, true)
assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, false)

tiModes.set('retention_org_poison', 'missing')
const poisonRequestId = randomUUID()
const poisonRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_poison', triggerType: 'manual', requestedBy: users[5], requestId: poisonRequestId, retentionDays: 30 })
assert.equal((await runOrganizationRetentionWorker(poisonRun.id)).failed, true)
const fairRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_fair', triggerType: 'manual', requestedBy: users[6], requestId: randomUUID(), retentionDays: 30 })
await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [poisonRun.id])
const fairResult = await runOrganizationRetentionWorker()
assert.equal(fairResult.runId, fairRun.id, 'an attempt-zero tenant must run before an older retrying tenant')
for (let attempt = 2; attempt <= 5; attempt += 1) {
    await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [poisonRun.id])
    const result = await runOrganizationRetentionWorker(poisonRun.id)
    assert.equal(result.failed, true)
    const persisted = (await queryOnce('SELECT status, attempt_count, EXTRACT(EPOCH FROM (next_retry_at - NOW()))::int retry_delay FROM organization_retention_runs WHERE id = $1', [poisonRun.id])).rows[0]
    assert.equal(persisted.attempt_count, attempt)
    assert.equal(persisted.status, attempt === 5 ? 'dead_letter' : 'failed')
    if (attempt < 5) assert.equal(persisted.retry_delay >= 60 * 2 ** (attempt - 1) - 5, true)
}
assert.deepEqual(await runOrganizationRetentionWorker(poisonRun.id), { claimed: false })

const concurrentResults = await Promise.allSettled([
    queueOrganizationRetentionRun({ organizationId: 'retention_org_concurrent', triggerType: 'manual', requestedBy: users[8], requestId: randomUUID(), retentionDays: 30 }),
    queueOrganizationRetentionRun({ organizationId: 'retention_org_concurrent', triggerType: 'privacy_deletion', requestedBy: users[8], requestId: randomUUID(), retentionDays: 30 }),
])
assert.deepEqual(concurrentResults.map(result => result.status).sort(), ['fulfilled', 'rejected'])
const concurrentRun = concurrentResults.find(result => result.status === 'fulfilled')
assert.equal(Boolean(concurrentRun && await runOrganizationRetentionWorker(concurrentRun.value.id)), true)

await queryOnce(`
    INSERT INTO organization_retention_runs (id, organization_id, trigger_type, status, retention_days, cutoff_at, completed_at)
    VALUES ('retention_page_run', 'retention_org_page', 'manual', 'completed', 30, $1, NOW())
`, [old])
await queryOnce(`
    INSERT INTO organization_retention_run_items (run_id, organization_id, source_service, record_type, record_id, action, status, reason)
    SELECT 'retention_page_run', 'retention_org_page', 'ti-scraper', 'capture', 'protected-' || value, 'retain', 'protected', 'legal_hold'
      FROM generate_series(1, 105) value
`)
const firstProtectedPage = await organizationPrivacyState('retention_org_page', { itemOffset: 0, itemLimit: 100 })
const secondProtectedPage = await organizationPrivacyState('retention_org_page', { itemOffset: 100, itemLimit: 100 })
assert.equal(firstProtectedPage.items.length, 100)
assert.equal(firstProtectedPage.itemPage.nextOffset, 100)
assert.equal(secondProtectedPage.items.length, 5)
assert.equal(secondProtectedPage.itemPage.nextOffset, null)

const app = Fastify({ logger: false })
app.post('/api/logs/ingest', ingestLog)
app.post('/api/organizations/:id/privacy', postOrganizationPrivacy)
app.put('/api/organizations/:id/settings', putOrganizationSettings)
await app.ready()
const deadLetterReplay = await app.inject({
    method: 'POST', url: '/api/organizations/retention_org_poison/privacy',
    headers: { authorization: 'Bearer retention-poison-token', id: users[5] },
    payload: { action: 'run_retention', requestId: poisonRequestId },
})
assert.equal(deadLetterReplay.statusCode, 502, deadLetterReplay.body)
assert.match(deadLetterReplay.body, /failed after 5 attempts/i)

tiModes.set('retention_org_locked', 'record-failure')
const lockedRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_locked', triggerType: 'privacy_deletion', requestedBy: users[13], requestId: randomUUID(), retentionDays: 30 })
assert.equal((await runOrganizationRetentionWorker(lockedRun.id)).failed, true)
const durableLock = (await queryOnce('SELECT status, audit_safe_metadata FROM organizations WHERE id = \'retention_org_locked\'')).rows[0]
assert.equal(durableLock.status, 'archived')
assert.equal(durableLock.audit_safe_metadata.privacyDeletionRunId, lockedRun.id)
const lockedMutation = await app.inject({
    method: 'PUT', url: '/api/organizations/retention_org_locked/settings',
    headers: { authorization: 'Bearer retention-locked-token', id: users[13] },
    payload: { retentionDays: 60 },
})
assert.equal(lockedMutation.statusCode, 409, lockedMutation.body)
assert.match(lockedMutation.body, /deletion is in progress/i)
tiModes.delete('retention_org_locked')
await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [lockedRun.id])
assert.equal((await runOrganizationRetentionWorker(lockedRun.id)).failed, false)

const adminDeletion = await app.inject({
    method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
    headers: { authorization: 'Bearer retention-admin-token', id: users[10] },
    payload: { action: 'delete', requestId: 'admin-delete', confirmation: 'Authenticated Deletion', currentPassword },
})
assert.equal(adminDeletion.statusCode, 403, adminDeletion.body)
const wrongConfirmation = await app.inject({
    method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
    headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
    payload: { action: 'delete', requestId: 'wrong-name', confirmation: 'client-controlled name', currentPassword },
})
assert.equal(wrongConfirmation.statusCode, 400, wrongConfirmation.body)
const wrongPassword = await app.inject({
    method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
    headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
    payload: { action: 'delete', requestId: 'wrong-password', confirmation: 'Authenticated Deletion', currentPassword: 'wrong' },
})
assert.equal(wrongPassword.statusCode, 403, wrongPassword.body)
const authenticatedDeletion = await app.inject({
    method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
    headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
    payload: { action: 'delete', requestId: 'authenticated-delete', confirmation: 'Authenticated Deletion', currentPassword },
})
assert.equal(authenticatedDeletion.statusCode, 200, authenticatedDeletion.body)
assert.equal((await queryOnce('SELECT status FROM organizations WHERE id = \'retention_org_auth\'')).rows[0].status, 'deleted')
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_auth\'')).rows[0].count, 0)

await queryOnce('INSERT INTO organization_privacy_requests (id, organization_id, request_type, requested_by, request_id) VALUES (\'privacy_delete_c\', \'retention_org_c\', \'deletion\', $1, $2)', [users[2], randomUUID()])
const adminAuditId = (await queryOnce(`
    INSERT INTO admin_audit_events (
        action_type, severity, source, service, actor_id, target_type, target_id,
        organization_id, entity_id, request_id, outcome, reason, context, ip, user_agent
    ) VALUES (
        'retention.raw-audit', 'notice', 'admin', 'hanasand-api', $1, 'customer',
        'raw-target@example.test', 'retention_org_c', 'raw-entity@example.test',
        'raw-request@example.test', 'success', 'raw customer reason',
        '{"rawCustomer":"sensitive audit context"}'::jsonb, '203.0.113.42', 'raw-customer-agent'
    ) RETURNING id
`, [users[2]])).rows[0].id
await queryOnce(`
    INSERT INTO dwm_webhook_audit_events (id, owner_id, actor_id, org_id, action, metadata)
    VALUES ('audit_delete_c', $1, $1, 'retention_org_c', 'retention.raw-webhook', '{"rawCustomer":"sensitive webhook context"}'::jsonb)
`, [users[2]])
const unscopedLogStart = (await queryOnce('SELECT COALESCE(MAX(id), 0) id FROM service_logs')).rows[0].id
await recordLog({
    service: 'secret-http-service', host: 'secret-http-host', level: 'error', message: 'secret HTTP response body',
    metadata: {
        category: 'http_response_error', surface: 'organizations', method: 'DELETE',
        path: '/api/organizations/retention_org_c/privacy?secret=unscoped-http-marker',
        request_id: 'unscoped-http-request-marker', user_id: 'unscoped-http-user-marker',
        ip: '203.0.113.44', user_agent: 'unscoped-http-agent-marker', referer: 'https://secret.example/customer',
        error_message: 'unscoped-http-error-marker', body: 'unscoped-http-body-marker',
    },
})
await recordLog({
    service: 'secret-onerror-service', host: 'secret-onerror-host', level: 'error', message: 'unscoped-onerror-message-marker',
    metadata: {
        method: 'POST', url: '/api/admin/support/organizations/retention_org_c?secret=unscoped-onerror-url-marker',
        error: 'unscoped-onerror-error-marker', stack: 'unscoped-onerror-stack-marker',
    },
})
const unscopedLogs = (await queryOnce('SELECT service, host, level, message, metadata FROM service_logs WHERE id > $1 AND message = \'organization_request_error\' ORDER BY id', [unscopedLogStart])).rows
assert.deepEqual(unscopedLogs, [
    { service: 'hanasand-api', host: '', level: 'error', message: 'organization_request_error', metadata: { category: 'organization_request_error', surface: 'organizations' } },
    { service: 'hanasand-api', host: '', level: 'error', message: 'organization_request_error', metadata: { category: 'organization_request_error', surface: 'organizations' } },
])
const beforeDeleteIngest = await app.inject({
    method: 'POST', url: '/api/logs/ingest', headers: { authorization: `Bearer ${process.env.VM_API_TOKEN}` },
    payload: {
        service: 'internal-ingest-service-marker', host: 'raw-customer-host', level: 'fatal', message: 'internal-ingest-message-marker',
        metadata: {
            category: 'organization_privacy', action: 'delete', organizationId: 'retention_org_c', tenantId: 'retention_org_c',
            actorId: users[2], requestId: 'raw-service-request@example.test', outcome: 'failed',
            error: 'raw service customer context from 203.0.113.43', body: 'internal-ingest-body-marker',
        },
    },
})
assert.equal(beforeDeleteIngest.statusCode, 201, beforeDeleteIngest.body)
const beforeDeleteServiceLog = (await queryOnce('SELECT id, service, host, level, message, metadata FROM service_logs WHERE service = \'internal-ingest-service-marker\' ORDER BY id DESC LIMIT 1')).rows[0]
assert.equal(JSON.stringify(beforeDeleteServiceLog).includes('internal-ingest-message-marker'), true)
assert.equal(JSON.stringify(beforeDeleteServiceLog).includes('raw-service-request@example.test'), true)
const serviceLogId = beforeDeleteServiceLog.id
const deletion = await queueOrganizationRetentionRun({ organizationId: 'retention_org_c', triggerType: 'privacy_deletion', requestedBy: users[2], requestId: randomUUID(), privacyRequestId: 'privacy_delete_c', retentionDays: 30 })
await queryOnce('INSERT INTO dwm_webhook_deliveries (id, owner_id, org_id, alert_id, event_type, status, dry_run, payload, idempotency_key, created_at, updated_at) VALUES (\'delivery_delete_after_cutoff\', $1, \'retention_org_c\', \'alert_after_cutoff\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"newer customer payload"}\', \'delivery-delete-after-cutoff\', NOW() + INTERVAL \'1 minute\', NOW() + INTERVAL \'1 minute\')', [users[2]])
assert.equal((await runOrganizationRetentionWorker(deletion.id)).failed, false)
const tombstone = (await queryOnce('SELECT * FROM organizations WHERE id = \'retention_org_c\'')).rows[0]
assert.equal(tombstone.status, 'deleted')
assert.equal(tombstone.name, 'Deleted organization')
assert.equal(tombstone.slug, 'deleted-retention_org_c')
assert.equal(tombstone.created_by, null)
assert.equal(tombstone.default_webhook_policy, 'disabled')
assert.equal(tombstone.retention_days, 30)
assert.equal(tombstone.audit_safe_metadata.privacyDeletionRunId, deletion.id)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_c\'')).rows[0].count, 0)
assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_delete_after_cutoff\'')).rows[0].payload, {})
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_b\' AND status = \'active\'')).rows[0].count, 1)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_delete_hold\'')).rows[0].count, 1)
assert.equal((await queryOnce('SELECT status FROM organization_privacy_requests WHERE id = \'privacy_delete_c\'')).rows[0].status, 'completed')
assert.equal((await queryOnce('SELECT protected_count FROM organization_retention_runs WHERE id = $1', [deletion.id])).rows[0].protected_count > 0, true)
const redactedAdminAudit = (await queryOnce('SELECT action_type, actor_id, target_id, entity_id, request_id, outcome, reason, context, ip, user_agent FROM admin_audit_events WHERE id = $1', [adminAuditId])).rows[0]
assert.deepEqual(redactedAdminAudit, {
    action_type: 'retention.raw-audit', actor_id: null, target_id: null, entity_id: null, request_id: null,
    outcome: 'success', reason: '', context: { privacyDeletionRunId: deletion.id }, ip: '', user_agent: '',
})
const redactedWebhookAudit = (await queryOnce('SELECT action, owner_id, actor_id, metadata FROM dwm_webhook_audit_events WHERE id = \'audit_delete_c\'')).rows[0]
assert.deepEqual(redactedWebhookAudit, { action: 'retention.raw-webhook', owner_id: null, actor_id: null, metadata: { privacyDeletionRunId: deletion.id } })
const redactedServiceLog = (await queryOnce('SELECT service, host, level, message, metadata FROM service_logs WHERE id = $1', [serviceLogId])).rows[0]
assert.deepEqual(redactedServiceLog, {
    service: 'hanasand-api', host: '', level: 'info', message: 'delete',
    metadata: { category: 'organization_privacy', action: 'delete', organizationId: 'retention_org_c', tenantId: 'retention_org_c', outcome: 'failed', privacyDeletionRunId: deletion.id },
})

await app.close()
await ensureSchema()
const restartedApp = Fastify({ logger: false })
restartedApp.post('/api/logs/ingest', ingestLog)
await restartedApp.ready()
const postDeleteLogStart = (await queryOnce('SELECT COALESCE(MAX(id), 0) id FROM service_logs')).rows[0].id
const postDeleteIngest = await restartedApp.inject({
    method: 'POST', url: '/api/logs/ingest', headers: { authorization: `Bearer ${process.env.VM_API_TOKEN}` },
    payload: {
        service: 'post-delete-service-marker', host: 'post-delete-host-marker', level: 'fatal', message: 'post-delete-message-marker',
        metadata: {
            category: 'post-delete-category-marker', action: 'post-delete-action-marker',
            organizationId: 'retention_org_c', tenantId: 'retention_org_c', outcome: 'post-delete-outcome-marker',
            requestId: 'post-delete-request-marker', error: 'post-delete-error-marker', body: 'post-delete-body-marker',
        },
    },
})
assert.equal(postDeleteIngest.statusCode, 201, postDeleteIngest.body)
const postDeleteServiceLog = (await queryOnce('SELECT id, service, host, level, message, metadata FROM service_logs WHERE id > $1 ORDER BY id LIMIT 1', [postDeleteLogStart])).rows[0]
assert.deepEqual(postDeleteServiceLog, {
    id: postDeleteServiceLog.id,
    service: 'hanasand-api', host: '', level: 'info', message: 'organization_event',
    metadata: {
        category: 'organization_privacy', action: 'post_delete_event', organizationId: 'retention_org_c', tenantId: 'retention_org_c',
        outcome: 'recorded', privacyDeletionRunId: deletion.id,
    },
})
await restartedApp.close()

const postDeleteExport = await exportOrganizationPrivacyData('retention_org_c')
assert.equal((postDeleteExport.data.public.organization as { name: string }).name, 'Deleted organization')
assert.equal((postDeleteExport.data.public.organization as { created_by: string | null }).created_by, null)
assert.deepEqual(postDeleteExport.data.public.members, [])
assert.equal((postDeleteExport.data.public.invites as Array<{ id: string }>).some(invite => invite.id === 'invite_delete_hold'), true)
assert.equal(JSON.stringify(postDeleteExport).includes('Sensitive Customer C'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('sensitive-customer-c'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('raw customer reason'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('sensitive audit context'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('sensitive webhook context'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('203.0.113.42'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('raw-customer-host'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('raw-service-request@example.test'), false)
assert.equal(JSON.stringify(postDeleteExport).includes('203.0.113.43'), false)
const retainedServiceLogs = JSON.stringify((await queryOnce('SELECT service, host, message, metadata FROM service_logs WHERE id > $1 ORDER BY id', [unscopedLogStart])).rows)
for (const marker of ['internal-ingest', 'unscoped-http', 'unscoped-onerror', 'post-delete-', 'secret-http', 'secret-onerror', 'secret HTTP', 'raw service customer context', 'raw-service-request', '203.0.113.43']) {
    assert.equal(JSON.stringify(postDeleteExport).includes(marker), false)
    assert.equal(retainedServiceLogs.includes(marker), false)
}
assert.equal((postDeleteExport.data.public.service_logs as Array<{ id: string }>).some(log => String(log.id) === String(serviceLogId)), true)
assert.equal((postDeleteExport.data.public.service_logs as Array<{ id: string }>).some(log => String(log.id) === String(postDeleteServiceLog.id)), true)
const postDeleteState = await organizationPrivacyState('retention_org_c')
assert.equal(postDeleteState.protection.immutable_service_logs, 2)
assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'service_log\' AND status = \'redacted\'', [deletion.id])).rows[0].count, 1)

const counts = (await queryOnce('SELECT selected_count, protected_count, deleted_count, redacted_count, failed_count, retried_count FROM organization_retention_runs WHERE id = $1', [runA.id])).rows[0]
assert.equal(counts.selected_count, counts.protected_count + counts.deleted_count + counts.redacted_count + counts.failed_count + counts.retried_count)
console.log('organization retention PostgreSQL lifecycle smoke: ok')
process.exit(0)
