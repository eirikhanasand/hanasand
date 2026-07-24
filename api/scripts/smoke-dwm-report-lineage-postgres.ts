import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { queryOnce } from '../src/utils/db.ts'
import ensureSchema from '../src/utils/db/ensureSchema.ts'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'
import {
    computeOutboundThirdPartyReportChecksum,
    deliverDwmAlertNotification,
    listDwmWebhookDeliveries,
    listDwmWebhookReceiverReceipts,
    normalizeDwmWebhookDestinationInput,
    recordDwmWebhookReceiverReceipt,
    retryDwmWebhookDelivery,
    signDwmWebhookDeliveryBody,
} from '../src/utils/dwm/webhooks.ts'

const phase = process.argv[2]
const database = 'hanasand_reporting_test'
const ownerId = 'report_pg_owner'
const adminId = 'report_pg_admin'
const orgId = 'report_pg_org'
const destinationId = 'report_pg_destination'
const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
const receiverObservationPath = '/tmp/hanasand-reporting-receiver-observation.json'
const receiverReceivedAt = '2026-07-24T10:00:00.000Z'

assert.equal(process.env.DB, database, `Refusing to run outside the disposable ${database} database.`)
assert.ok(['exercise', 'verify', 'cleanup'].includes(phase), 'Usage: bun scripts/smoke-dwm-report-lineage-postgres.ts exercise|verify|cleanup')
process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
process.env.TI_SCRAPER_SERVICE_TOKEN = 'reporting-pg-receiver-signature'
process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl

if (phase === 'exercise') await exercise()
if (phase === 'verify') await verifyAfterRestart()
if (phase === 'cleanup') await cleanup()

async function exercise() {
    await ensureSchema()
    await cleanup()
    await seed()

    let concurrentNetworkAttempts = 0
    const concurrentInput = deliveryInput('concurrent', false)
    const concurrentSender = async (_endpoint: string, body: string) => {
        concurrentNetworkAttempts += 1
        await Bun.sleep(20)
        const receiver = await recordDwmWebhookReceiverReceipt({
            eventId: 'receiver_pg_concurrent',
            receivedAt: receiverReceivedAt,
            payload: JSON.parse(body),
            signature: signDwmWebhookDeliveryBody(body, receiverUrl),
        })
        assert.equal(receiver.ok, true)
        assert.equal(receiver.ok && receiver.created, true)
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
    const concurrentReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_concurrent',
    })
    assert.equal(concurrentReceipts.length, 1)
    const concurrentAttempt = concurrentRows.find(row => row.attempted_at)
    assert.equal(concurrentReceipts[0].payloadHash, concurrentAttempt?.payload_hash)
    assert.equal(concurrentReceipts[0].deliveryId, concurrentAttempt?.id)
    assert.equal(concurrentReceipts[0].payloadDeliveryId, concurrentAttempt?.id)

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

    let originalReceiverBody = ''
    const [failed] = await deliverDwmAlertNotification(ownerId, deliveryInput('restart', false), async (_endpoint, body) => {
        originalReceiverBody = body
        return { status: 503, body: 'receiver unavailable' }
    })
    assert.equal(failed.status, 'failed')
    assert.equal(failed.attemptCount, 1)
    assert.ok(failed.id)
    assert.ok(failed.idempotencyKey.includes(failed.payload.report.exportChecksum))
    assert.equal(failed.payloadHash, payloadHash(originalReceiverBody))
    let prematureNetworkAttempts = 0
    const premature = await retryDwmWebhookDelivery(adminId, orgId, failed.id, async () => {
        prematureNetworkAttempts += 1
        return { status: 204, body: 'must not be sent before due' }
    })
    assert.equal(premature.ok, false)
    assert.equal(premature.code, 'delivery_retry_not_ready')
    assert.equal(new Date(premature.nextRetryAt).toISOString(), new Date(failed.nextRetryAt).toISOString())
    assert.equal(prematureNetworkAttempts, 0)
    await writeFile(receiverObservationPath, JSON.stringify({
        body: originalReceiverBody,
        payloadHash: failed.payloadHash,
        idempotencyKey: failed.idempotencyKey,
        deliveryId: failed.id,
        prematureRetryBlocked: true,
    }))
    for (let index = 0; index < 101; index += 1) {
        const [generic] = await deliverDwmAlertNotification(ownerId, {
            ...deliveryInput(`generic_${index}`, true),
            alert: {
                ...deliveryInput(`generic_${index}`, true).alert,
                report: undefined,
            },
        })
        assert.equal(generic.status, 'dry_run')
    }
    const reportRowsPastLimit = await listDwmWebhookDeliveries(adminId, orgId, {
        alertId: 'report_pg_alert_restart',
        reportCaseId: 'case_restart',
        reportExportChecksum: failed.payload.report.exportChecksum,
    })
    assert.deepEqual(reportRowsPastLimit.map(row => row.id), [failed.id])

    console.log(JSON.stringify({
        phase,
        database,
        concurrentNetworkAttempts,
        concurrentStatuses: concurrent.flat().map(item => item.status).sort(),
        dryRuns: budgetRows.filter(row => row.dry_run).length,
        liveBudgetAttempts: budgetRows.filter(row => row.attempted_at).length,
        blockedAfterBudget: budgetStatuses.at(-1),
        persistedFailedDeliveryId: failed.id,
        nextRetryAt: failed.nextRetryAt,
        reportReceiptPastHundredRows: reportRowsPastLimit.length === 1,
        durableReceiverReceipts: concurrentReceipts.length,
        prematureRetryBlocked: true,
        next: `Stop and restart PostgreSQL, then rerun this script with DB=${database} and phase verify; verification waits until the persisted retry due time.`,
    }, null, 2))
}

async function verifyAfterRestart() {
    const persistedReceiverReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_concurrent',
    })
    assert.equal(persistedReceiverReceipts.length, 1)
    const concurrentRowsBeforeReplay = await deliveryRows('report_pg_alert_concurrent')
    const concurrentPayload = concurrentRowsBeforeReplay.find(row => row.attempted_at)?.payload
    const replayedReceiver = await recordDwmWebhookReceiverReceipt({
        eventId: 'receiver_pg_concurrent',
        receivedAt: receiverReceivedAt,
        payload: concurrentPayload,
        signature: signDwmWebhookDeliveryBody(canonicalJson(concurrentPayload), receiverUrl),
    })
    assert.equal(replayedReceiver.ok, true)
    assert.equal(replayedReceiver.ok && replayedReceiver.created, false)

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
    const receiverObservation = JSON.parse(await readFile(receiverObservationPath, 'utf8')) as {
        body: string
        payloadHash: string
        idempotencyKey: string
        deliveryId: string
        prematureRetryBlocked: boolean
    }
    const storedPayload = canonicalJson(prior.payload)
    const storedIdempotencyKey = prior.idempotency_key
    assert.equal(prior.id, receiverObservation.deliveryId)
    assert.equal(storedPayload, receiverObservation.body)
    assert.equal(prior.payload_hash, receiverObservation.payloadHash)
    assert.equal(prior.idempotency_key, receiverObservation.idempotencyKey)
    const reportRowsPastLimit = await listDwmWebhookDeliveries(adminId, orgId, {
        alertId: 'report_pg_alert_restart',
        reportCaseId: 'case_restart',
        reportExportChecksum: prior.payload.report.exportChecksum,
    })
    assert.deepEqual(reportRowsPastLimit.map(row => row.id), [prior.id])
    const retryDelayMs = Math.max(0, new Date(prior.next_retry_at).getTime() - Date.now())
    if (retryDelayMs) await Bun.sleep(retryDelayMs + 50)
    const sentBodies: string[] = []

    const retried = await retryDwmWebhookDelivery(adminId, orgId, prior.id, async (_endpoint, body) => {
        sentBodies.push(body)
        const receiver = await recordDwmWebhookReceiverReceipt({
            eventId: 'receiver_pg_restart',
            receivedAt: '2026-07-24T10:05:00.000Z',
            payload: JSON.parse(body),
            signature: signDwmWebhookDeliveryBody(body, receiverUrl),
        })
        assert.equal(receiver.ok, true)
        assert.equal(receiver.ok && receiver.created, true)
        return { status: 204, body: 'accepted after restart' }
    })
    assert.equal(retried.ok, true, JSON.stringify(retried))
    assert.deepEqual(sentBodies, [receiverObservation.body])
    assert.equal(retried.delivery.payloadHash, receiverObservation.payloadHash)
    assert.equal(retried.delivery.idempotencyKey, storedIdempotencyKey)
    assert.equal(retried.delivery.ownerId, ownerId)
    assert.equal(retried.delivery.auditActorId, adminId)
    assert.equal(retried.delivery.attemptCount, 2)
    assert.deepEqual(retried.delivery.payload, prior.payload)
    const restartReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_restart',
    })
    assert.equal(restartReceipts.length, 1)
    assert.equal(restartReceipts[0].deliveryId, retried.delivery.id)
    assert.equal(restartReceipts[0].payloadDeliveryId, prior.id)
    assert.equal(restartReceipts[0].payloadHash, prior.payload_hash)

    let duplicateNetworkAttempts = 0
    const [duplicate] = await deliverDwmAlertNotification(ownerId, deliveryInput('restart', false), async () => {
        duplicateNetworkAttempts += 1
        return { status: 204, body: 'duplicate must not reach receiver' }
    })
    assert.equal(duplicate.status, 'skipped')
    assert.equal(duplicateNetworkAttempts, 0)
    assert.equal((await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_restart',
    })).length, 1)

    const restartRows = await deliveryRows('report_pg_alert_restart')
    const attemptedRestartRows = restartRows.filter(row => row.attempted_at)
    assert.equal(attemptedRestartRows.length, 2)
    assert.equal(restartRows.filter(row => row.status === 'delivered').length, 1)
    assert.equal(new Set(restartRows.map(row => row.idempotency_key)).size, 1)
    assert.ok(attemptedRestartRows.every(row => canonicalJson(row.payload) === receiverObservation.body))
    assert.ok(attemptedRestartRows.every(row => row.payload_hash === receiverObservation.payloadHash))

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
        exactOriginalReceiverBody: sentBodies[0] === receiverObservation.body,
        exactOriginalReceiverPayloadHash: retried.delivery.payloadHash === receiverObservation.payloadHash,
        prematureRetryBlocked: receiverObservation.prematureRetryBlocked,
        reportReceiptPastHundredRows: reportRowsPastLimit.length === 1,
        durableReceiverReceiptAfterRestart: persistedReceiverReceipts.length === 1,
        retryReceiptBoundToAuthoritativeDelivery: restartReceipts[0].deliveryId === retried.delivery.id,
        duplicateNetworkAttempts,
        receiverReplayCreatedDuplicate: replayedReceiver.ok && replayedReceiver.created,
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
        endpointUrl: receiverUrl,
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
    await unlink(receiverObservationPath).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_audit_events WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_deliveries WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_destinations WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organization_members WHERE organization_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM tokens WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    await queryOnce('DELETE FROM users WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    if (phase === 'cleanup') console.log(JSON.stringify({ phase, database, cleaned: true }, null, 2))
}

function payloadHash(body: string) {
    return `payload_${createHash('sha256').update(body).digest('hex').slice(0, 32)}`
}
