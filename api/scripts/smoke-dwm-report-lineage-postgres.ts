import assert from 'node:assert/strict'
import { queryOnce } from '../src/utils/db.ts'
import ensureSchema from '../src/utils/db/ensureSchema.ts'
import {
    computeOutboundThirdPartyReportChecksum,
    deliverDwmAlertNotification,
    normalizeDwmWebhookDestinationInput,
    retryDwmWebhookDelivery,
} from '../src/utils/dwm/webhooks.ts'

const phase = process.argv[2]
const database = 'hanasand_reporting_test'
const ownerId = 'report_pg_owner'
const adminId = 'report_pg_admin'
const orgId = 'report_pg_org'
const destinationId = 'report_pg_destination'

assert.equal(process.env.DB, database, `Refusing to run outside the disposable ${database} database.`)
assert.ok(['exercise', 'verify', 'cleanup'].includes(phase), 'Usage: bun scripts/smoke-dwm-report-lineage-postgres.ts exercise|verify|cleanup')
process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'

if (phase === 'exercise') await exercise()
if (phase === 'verify') await verifyAfterRestart()
if (phase === 'cleanup') await cleanup()

async function exercise() {
    await ensureSchema()
    await cleanup()
    await seed()

    let concurrentNetworkAttempts = 0
    const concurrentInput = deliveryInput('concurrent', false)
    const concurrentSender = async () => {
        concurrentNetworkAttempts += 1
        await Bun.sleep(20)
        return { status: 204, body: 'accepted' }
    }
    const concurrent = await Promise.all([
        deliverDwmAlertNotification(ownerId, concurrentInput, concurrentSender),
        deliverDwmAlertNotification(adminId, concurrentInput, concurrentSender),
    ])
    assert.equal(concurrentNetworkAttempts, 1)
    assert.deepEqual(concurrent.flat().map(item => item.status).sort(), ['delivered', 'skipped'])
    const concurrentRows = await deliveryRows('report_pg_alert_concurrent')
    assert.equal(concurrentRows.filter(row => row.attempted_at).length, 1)
    assert.equal(new Set(concurrentRows.map(row => row.idempotency_key)).size, 1)
    assert.deepEqual(new Set(concurrentRows.map(row => row.owner_id)), new Set([ownerId, adminId]))

    let budgetNetworkAttempts = 0
    const budgetSender = async () => {
        budgetNetworkAttempts += 1
        return { status: 503, body: 'retry later' }
    }
    for (const actor of [ownerId, adminId, ownerId]) {
        const [dryRun] = await deliverDwmAlertNotification(actor, deliveryInput('budget', true), budgetSender)
        assert.equal(dryRun.status, 'dry_run')
        assert.equal(dryRun.attemptCount, 0)
    }
    const budgetStatuses: string[] = []
    for (let index = 0; index < 6; index += 1) {
        const [delivery] = await deliverDwmAlertNotification(index % 2 ? adminId : ownerId, deliveryInput('budget', false), budgetSender)
        budgetStatuses.push(delivery.status)
    }
    assert.equal(budgetNetworkAttempts, 5)
    assert.deepEqual(budgetStatuses, ['failed', 'failed', 'failed', 'failed', 'failed', 'skipped'])
    const budgetRows = await deliveryRows('report_pg_alert_budget')
    assert.equal(budgetRows.filter(row => row.dry_run).length, 3)
    assert.equal(budgetRows.filter(row => row.attempted_at).length, 5)
    assert.equal(budgetRows.filter(row => row.status === 'skipped').length, 1)

    const [failed] = await deliverDwmAlertNotification(ownerId, deliveryInput('restart', false), async () => ({
        status: 503,
        body: 'receiver unavailable',
    }))
    assert.equal(failed.status, 'failed')
    assert.equal(failed.attemptCount, 1)
    assert.ok(failed.id)
    assert.ok(failed.idempotencyKey.includes(failed.payload.report.exportChecksum))

    console.log(JSON.stringify({
        phase,
        database,
        concurrentNetworkAttempts,
        concurrentStatuses: concurrent.flat().map(item => item.status).sort(),
        dryRuns: budgetRows.filter(row => row.dry_run).length,
        liveBudgetAttempts: budgetRows.filter(row => row.attempted_at).length,
        blockedAfterBudget: budgetStatuses.at(-1),
        persistedFailedDeliveryId: failed.id,
        next: `Stop and restart PostgreSQL, then rerun this script with DB=${database} and phase verify.`,
    }, null, 2))
}

async function verifyAfterRestart() {
    const priorResult = await queryOnce(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND alert_id = 'report_pg_alert_restart'
          AND status = 'failed'
          AND attempted_at IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
    `, [orgId])
    const prior = priorResult.rows[0]
    assert.ok(prior, 'Exercise phase did not persist the failed report delivery.')
    const storedPayload = JSON.stringify(prior.payload)
    const storedIdempotencyKey = prior.idempotency_key
    const sentBodies: string[] = []

    const retried = await retryDwmWebhookDelivery(adminId, orgId, prior.id, async (_endpoint, body) => {
        sentBodies.push(body)
        return { status: 204, body: 'accepted after restart' }
    })
    assert.equal(retried.ok, true, JSON.stringify(retried))
    assert.deepEqual(sentBodies, [storedPayload])
    assert.equal(retried.delivery.idempotencyKey, storedIdempotencyKey)
    assert.equal(retried.delivery.ownerId, ownerId)
    assert.equal(retried.delivery.auditActorId, adminId)
    assert.equal(retried.delivery.attemptCount, 2)
    assert.deepEqual(retried.delivery.payload, prior.payload)

    const restartRows = await deliveryRows('report_pg_alert_restart')
    assert.equal(restartRows.filter(row => row.attempted_at).length, 2)
    assert.equal(restartRows.filter(row => row.status === 'delivered').length, 1)
    assert.equal(new Set(restartRows.map(row => row.idempotency_key)).size, 1)
    assert.ok(restartRows.every(row => JSON.stringify(row.payload) === storedPayload))

    const budgetRows = await deliveryRows('report_pg_alert_budget')
    assert.equal(budgetRows.filter(row => row.dry_run).length, 3)
    assert.equal(budgetRows.filter(row => row.attempted_at).length, 5)
    assert.equal(budgetRows.filter(row => row.status === 'skipped').length, 1)

    const concurrentRows = await deliveryRows('report_pg_alert_concurrent')
    assert.equal(concurrentRows.filter(row => row.attempted_at).length, 1)

    console.log(JSON.stringify({
        phase,
        database,
        restartReconnect: true,
        retriedDeliveryId: retried.delivery.id,
        priorDeliveryId: prior.id,
        exactStoredPayload: sentBodies[0] === storedPayload,
        exactIdempotencyLineage: retried.delivery.idempotencyKey === storedIdempotencyKey,
        retryActorAuditOnly: retried.delivery.ownerId === ownerId && retried.delivery.auditActorId === adminId,
        concurrentActualAttempts: concurrentRows.filter(row => row.attempted_at).length,
        dryRunsOutsideBudget: budgetRows.filter(row => row.dry_run).length,
        maximumActualAttempts: budgetRows.filter(row => row.attempted_at).length,
    }, null, 2))
}

async function seed() {
    await queryOnce(`
        INSERT INTO users (id, name, password, avatar, active)
        VALUES
            ($1, 'Reporting PG owner', 'local-test', '', TRUE),
            ($2, 'Reporting PG admin', 'local-test', '', TRUE)
    `, [ownerId, adminId])
    await queryOnce(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, 'Reporting PG organization', 'reporting-pg-organization', $2)
    `, [orgId, ownerId])
    await queryOnce(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES
            ($1, $2, 'owner', 'active', $2),
            ($1, $3, 'admin', 'active', $2)
    `, [orgId, ownerId, adminId])

    const destination = normalizeDwmWebhookDestinationInput({
        orgId,
        name: 'Instrumented external receiver',
        kind: 'webhook',
        endpointUrl: 'https://receiver.example.com/report',
        events: ['dwm.alert.updated'],
    }, ownerId)
    assert.ok(destination.endpointEncrypted && destination.endpointHint && destination.endpointHash)
    await queryOnce(`
        INSERT INTO dwm_webhook_destinations (
            id, owner_id, org_id, name, kind, endpoint_encrypted, endpoint_hint,
            endpoint_hash, status, events, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9::TEXT[], $2)
    `, [
        destinationId,
        ownerId,
        orgId,
        destination.name,
        destination.kind,
        destination.endpointEncrypted,
        destination.endpointHint,
        destination.endpointHash,
        destination.events,
    ])
}

function deliveryInput(lineage: string, dryRun: boolean) {
    const report = reportFixture(lineage)
    return {
        orgId,
        destinationId,
        eventType: 'dwm.alert.updated' as const,
        dryRun,
        live: true,
        alert: {
            id: `report_pg_alert_${lineage}`,
            organizationId: orgId,
            tenantId: orgId,
            dedupeKey: report.exportChecksum,
            title: 'Evidence-backed report delivery',
            firstSeenAt: '2026-07-23T10:00:00.000Z',
            report,
        },
    }
}

function reportFixture(lineage: string) {
    const evidenceId = `evidence_${lineage}`
    const draft = {
        schemaVersion: 'analyst.case_export.v1',
        generatedAt: '2026-07-23T10:00:00.000Z',
        evidence: [{ id: evidenceId, contentHash: `hash_${lineage}` }],
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'hanasand-json',
            caseId: `case_${lineage}`,
            alertId: `report_pg_alert_${lineage}`,
            organizationId: orgId,
            evidenceIds: [evidenceId],
            evidenceCount: 1,
        },
    }
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    return { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
}

async function deliveryRows(alertId: string) {
    return (await queryOnce(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1 AND alert_id = $2
        ORDER BY created_at, id
    `, [orgId, alertId])).rows
}

async function cleanup() {
    await queryOnce('DELETE FROM dwm_webhook_audit_events WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_deliveries WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_destinations WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organization_members WHERE organization_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM tokens WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    await queryOnce('DELETE FROM users WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    if (phase === 'cleanup') console.log(JSON.stringify({ phase, database, cleaned: true }, null, 2))
}
