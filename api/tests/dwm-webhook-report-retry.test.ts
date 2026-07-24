import { afterEach, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'

const queries: Array<{ sql: string, params: unknown[] }> = []
const ledger: Array<Record<string, any>> = []
const receiverAudits: Array<Record<string, any>> = []
const lockTails = new Map<string, Promise<void>>()
let persistedDelivery: Record<string, any> | undefined
let insertedDelivery: Record<string, any> | undefined

mock.module('#db', () => ({
    withDatabaseAdvisoryLock: async <T>(key: string, work: () => Promise<T>) => {
        const previous = lockTails.get(key) || Promise.resolve()
        let release = () => {}
        const current = new Promise<void>(resolve => { release = resolve })
        lockTails.set(key, previous.then(() => current))
        await previous
        try {
            return await work()
        } finally {
            release()
        }
    },
    default: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        const deliveries = [...(persistedDelivery ? [persistedDelivery] : []), ...ledger]
        if (sql.includes('FROM dwm_webhook_deliveries') && sql.includes('WHERE id = $1')) {
            return { rows: deliveries.filter(row => row.id === params[0] && row.org_id === params[1]) }
        }
        if (sql.includes('SELECT COUNT(*)::INT AS count')) {
            return {
                rows: [{
                    count: deliveries.filter(row =>
                        row.org_id === params[0]
                        && row.destination_id === params[1]
                        && row.idempotency_key === params[2]
                        && !row.dry_run
                        && row.attempted_at
                    ).length,
                }],
            }
        }
        if (sql.includes('FROM dwm_webhook_destinations') && sql.includes('WHERE id = $1')) {
            return {
                rows: [{
                    id: 'destination_1',
                    owner_id: 'owner_1',
                    org_id: 'org_1',
                    name: 'Receiver',
                    kind: 'webhook',
                    endpoint_encrypted: 'https://receiver.example/hook',
                    endpoint_hint: 'receiver.example/...',
                    endpoint_hash: 'endpoint_hash',
                    status: 'active',
                    events: ['dwm.alert.updated'],
                    created_by: 'owner_1',
                    last_tested_at: null,
                    last_test_status: null,
                    last_test_error: null,
                    last_test_http_status: null,
                    last_delivery_at: null,
                    created_at: '2026-07-23T10:00:00.000Z',
                    updated_at: '2026-07-23T10:00:00.000Z',
                }],
            }
        }
        if (sql.includes('AND status IN (\'delivered\', \'failed\')')) {
            return {
                rows: deliveries.filter(row =>
                    row.org_id === params[0]
                    && row.destination_id === params[1]
                    && row.idempotency_key === params[2]
                    && ['delivered', 'failed'].includes(row.status)
                    && !row.dry_run
                    && row.attempted_at
                ).sort((left, right) => String(right.attempted_at).localeCompare(String(left.attempted_at))).slice(0, 1),
            }
        }
        if (sql.includes('AND status = \'delivered\'')) {
            return {
                rows: deliveries.filter(row =>
                    row.org_id === params[0]
                    && row.destination_id === params[1]
                    && row.idempotency_key === params[2]
                    && row.status === 'delivered'
                    && !row.dry_run
                    && row.attempted_at
                ).slice(-1),
            }
        }
        if (sql.includes('INSERT INTO dwm_webhook_audit_events') && sql.includes('\'receiver.accepted\'')) {
            if (receiverAudits.some(row => row.id === params[0])) return { rows: [] }
            const row = {
                id: params[0],
                owner_id: 'owner_1',
                actor_id: null,
                org_id: params[1],
                destination_id: params[2],
                delivery_id: null,
                action: 'receiver.accepted',
                metadata: JSON.parse(String(params[3])),
                created_at: '2026-07-24T10:00:01.000Z',
            }
            receiverAudits.push(row)
            return { rows: [row] }
        }
        if (sql.includes('FROM dwm_webhook_audit_events') && sql.includes('action = \'receiver.accepted\'')) {
            return {
                rows: receiverAudits.filter(row => row.org_id === (params.length === 5 ? params[0] : params[1])),
            }
        }
        if (sql.includes('INSERT INTO dwm_webhook_deliveries')) {
            const duplicateInsert = sql.includes('\'skipped\', FALSE')
            const retryInsert = sql.includes('$7, FALSE')
            const at = (normal: number, retry: number) => params[retryInsert ? retry : normal]
            insertedDelivery = duplicateInsert ? {
                id: params[0],
                destination_id: params[1],
                owner_id: params[2],
                org_id: params[3],
                alert_id: params[4],
                event_type: params[5],
                status: 'skipped',
                dry_run: false,
                endpoint_hint: params[6],
                endpoint_hash: params[7],
                payload_hash: params[8],
                payload: JSON.parse(String(params[9])),
                response_status: null,
                response_body: null,
                error: params[10],
                error_class: params[11],
                attempt_count: params[12],
                next_retry_at: null,
                idempotency_key: params[13],
                watchlist_id: params[14],
                watchlist_name: params[15],
                route: params[16],
                case_path: params[17],
                attempted_at: null,
                completed_at: null,
                delivered_at: null,
                created_at: new Date().toISOString(),
            } : {
                id: params[0],
                destination_id: params[1],
                owner_id: params[2],
                org_id: params[3],
                alert_id: params[4],
                event_type: params[5],
                status: params[6],
                dry_run: retryInsert ? false : Boolean(params[7]),
                endpoint_hint: at(8, 7),
                endpoint_hash: at(9, 8),
                payload_hash: at(10, 9),
                payload: JSON.parse(String(at(11, 10))),
                response_status: at(12, 11),
                response_body: at(13, 12),
                error: at(14, 13),
                error_class: at(15, 14),
                attempt_count: at(16, 15),
                next_retry_at: at(17, 16),
                idempotency_key: at(18, 17),
                watchlist_id: at(19, 18),
                watchlist_name: at(20, 19),
                route: at(21, 20),
                case_path: at(22, 21),
                attempted_at: at(23, 22),
                completed_at: at(24, 23),
                delivered_at: at(25, 24),
                created_at: new Date().toISOString(),
            }
            ledger.push(insertedDelivery)
            return { rows: [insertedDelivery] }
        }
        return { rows: [] }
    },
}))

afterEach(() => {
    queries.length = 0
    ledger.length = 0
    receiverAudits.length = 0
    lockTails.clear()
    persistedDelivery = undefined
    insertedDelivery = undefined
})

test('retries a failed report after persistence reload with the exact stored payload and idempotency lineage', async () => {
    const { computeOutboundThirdPartyReportChecksum, retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const draft = {
        bundle: {
            type: 'bundle',
            id: 'bundle--11111111-1111-4111-8111-111111111111',
            objects: [
                { type: 'identity', spec_version: '2.1', id: 'identity--11111111-1111-4111-8111-111111111111' },
                { type: 'x-ti-evidence', spec_version: '2.1', id: 'x-ti-evidence--11111111-1111-4111-8111-111111111111', x_ti_capture_id: 'capture_1', x_ti_source_id: 'source_1', x_ti_content_hash: 'hash_1' },
                { type: 'report', spec_version: '2.1', id: 'report--11111111-1111-4111-8111-111111111111', published: '2026-07-23T10:00:00.000Z', object_refs: ['x-ti-evidence--11111111-1111-4111-8111-111111111111'] },
            ],
        },
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'stix-2.1',
            caseId: 'case_1',
            alertId: 'alert_1',
            organizationId: 'org_1',
            evidenceIds: ['evidence_1'],
            evidenceCount: 1,
        },
        standardsValidation: { standard: 'STIX 2.1', valid: true, issues: [] },
    }
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    const report = { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
    const payload = {
        schemaVersion: 'dwm.webhook.v1',
        report,
        alert: { id: 'alert_1', title: 'Canonical report' },
        delivery: { dedupeKey: exportChecksum },
    }
    persistedDelivery = JSON.parse(JSON.stringify({
        id: 'failed_delivery_1',
        destination_id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        alert_id: 'alert_1',
        event_type: 'dwm.alert.updated',
        status: 'failed',
        dry_run: false,
        endpoint_hint: 'receiver.example/...',
        endpoint_hash: 'endpoint_hash',
        payload_hash: payloadHash(canonicalJson(payload)),
        payload,
        response_status: 503,
        response_body: 'retry later',
        error: 'Webhook returned HTTP 503.',
        error_class: 'upstream_5xx',
        attempt_count: 1,
        next_retry_at: '2020-07-23T10:01:00.000Z',
        idempotency_key: `dwm.alert.updated:org_1:destination_1:${exportChecksum}`,
        watchlist_id: null,
        watchlist_name: null,
        route: 'customer_webhook',
        case_path: '/dashboard/dwm/cases/case_1',
        attempted_at: '2026-07-23T10:00:00.000Z',
        completed_at: '2026-07-23T10:00:01.000Z',
        delivered_at: null,
        created_at: '2026-07-23T10:00:00.000Z',
    }))
    const sentBodies: string[] = []
    const previousLive = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    try {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', 'failed_delivery_1', async (_endpoint, body) => {
            sentBodies.push(body)
            return { status: 204, body: '' }
        })
        expect(result.ok).toBe(true)
        expect(sentBodies).toEqual([canonicalJson(payload)])
        expect(insertedDelivery?.payload_hash).toBe(persistedDelivery.payload_hash)
        expect(insertedDelivery?.payload).toEqual(payload)
        expect(insertedDelivery?.owner_id).toBe('owner_1')
        expect(insertedDelivery?.idempotency_key).toBe(persistedDelivery.idempotency_key)
        expect(insertedDelivery?.attempt_count).toBe(2)
        expect(queries.find(item => item.sql.includes('WHERE id = $1'))?.sql).toContain('organization_members')
        const audit = queries.find(item => item.sql.includes('INSERT INTO dwm_webhook_audit_events'))
        expect(audit?.params.slice(1, 4)).toEqual(['owner_1', 'member_2', 'org_1'])
        expect(String(audit?.params[7])).toContain('"priorDeliveryId":"failed_delivery_1"')
        expect(String(audit?.params[7])).toContain('"exactPersistedPayload":true')
    } finally {
        if (previousLive === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previousLive
    }
})

test('blocks an exact persisted retry until its due timestamp without a network attempt', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const nextRetryAt = '2099-07-23T10:01:00.000Z'
    persistedDelivery = failedDeliveryFixture(nextRetryAt)
    const previousLive = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    let networkAttempts = 0
    try {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({
            ok: false,
            status: 409,
            code: 'delivery_retry_not_ready',
            nextRetryAt,
        })
        expect(networkAttempts).toBe(0)
        expect(insertedDelivery).toBeUndefined()
    } finally {
        if (previousLive === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previousLive
    }
})

test('rejects a persisted payload whose canonical body no longer matches its hash', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    persistedDelivery = { ...failedDeliveryFixture('2020-07-23T10:01:00.000Z'), payload_hash: 'payload_tampered' }
    const previousLive = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    let networkAttempts = 0
    try {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({ ok: false, status: 409, code: 'persisted_payload_invalid' })
        expect(networkAttempts).toBe(0)
    } finally {
        if (previousLive === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previousLive
    }
})

test('filters exact report receipts in PostgreSQL before the bounded delivery ledger limit', async () => {
    const { listDwmWebhookDeliveries } = await import('../src/utils/dwm/webhooks.ts')
    await listDwmWebhookDeliveries('member_2', 'org_1', {
        alertId: 'alert_1',
        reportCaseId: 'case_1',
        reportExportChecksum: 'case_report_exact',
    })
    const query = queries.at(-1)
    expect(query?.params).toEqual(['org_1', 'alert_1', 'case_1', 'case_report_exact'])
    expect(query?.sql).toContain('metadata->>\'reportValidation\' AS report_validation')
    expect(query?.sql).toContain('audit.report_validation = \'valid\'')
    expect(query?.sql.indexOf('deliveries.alert_id = $2')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    expect(query?.sql.indexOf('audit.report_case_id = $3')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    expect(query?.sql.indexOf('audit.report_export_checksum = $4')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
})

test('exposes report identity from the persisted delivery audit projection', async () => {
    const { buildDwmWebhookDeliveryLedger, toDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const row = {
        ...failedDeliveryFixture('2020-07-23T10:01:00.000Z'),
        report_validation: 'valid',
        report_export_checksum: 'case_report_exact',
        report_case_id: 'case_1',
    }
    const ledger = buildDwmWebhookDeliveryLedger({
        deliveries: [toDwmWebhookDelivery(row)],
        filters: { reportCaseId: 'case_1', reportExportChecksum: 'case_report_exact' },
    })
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
        reportValidation: 'valid',
        reportExportChecksum: 'case_report_exact',
        reportCaseId: 'case_1',
        thirdPartyReport: true,
    })
})

test('persists one deterministic receiver receipt and filters it before the read limit', async () => {
    const {
        listDwmWebhookReceiverReceipts,
        recordDwmWebhookReceiverReceipt,
    } = await import('../src/utils/dwm/webhooks.ts')
    const payload = reportDeliveryPayload()
    const envelope = {
        eventId: 'receiver_event_1',
        receivedAt: '2026-07-24T10:00:00.000Z',
        payload,
    }
    const first = await recordDwmWebhookReceiverReceipt(envelope)
    const duplicate = await recordDwmWebhookReceiverReceipt(envelope)
    expect(first).toMatchObject({
        ok: true,
        created: true,
        receipt: {
            orgId: 'org_1',
            destinationId: 'destination_1',
            deliveryId: 'delivery_receiver_1',
            reportValidation: 'valid',
            reportCaseId: 'case_1',
        },
    })
    expect(duplicate).toMatchObject({
        ok: true,
        created: false,
        receipt: { id: first.ok ? first.receipt.id : '' },
    })
    expect(receiverAudits).toHaveLength(1)

    const receipts = await listDwmWebhookReceiverReceipts('org_1', {
        destinationId: 'destination_1',
        deliveryId: 'delivery_receiver_1',
        reportCaseId: 'case_1',
        reportExportChecksum: payload.report.exportChecksum,
    })
    expect(receipts).toHaveLength(1)
    const query = queries.at(-1)
    expect(query?.params).toEqual([
        'org_1',
        'destination_1',
        'delivery_receiver_1',
        'case_1',
        payload.report.exportChecksum,
    ])
    expect(query?.sql.indexOf('metadata->>\'reportCaseId\' = $4')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    expect(query?.sql.indexOf('metadata->>\'reportExportChecksum\' = $5')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
})

test('serializes the same org destination checksum across two admins', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    const previousLive = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    let networkAttempts = 0
    const sender = async () => {
        networkAttempts += 1
        await Bun.sleep(10)
        return { status: 204, body: '' }
    }
    const input = deliveryInput('checksum_concurrent', false)
    try {
        const [first, second] = await Promise.all([
            deliverDwmAlertNotification('owner_1', input, sender),
            deliverDwmAlertNotification('member_2', input, sender),
        ])
        expect(networkAttempts).toBe(1)
        expect([first[0]?.status, second[0]?.status].sort()).toEqual(['delivered', 'skipped'])
        expect(new Set(ledger.map(row => row.owner_id))).toEqual(new Set(['owner_1', 'member_2']))
        expect(new Set(ledger.map(row => row.idempotency_key))).toEqual(new Set([
            'dwm.alert.updated:org_1:destination_1:checksum_concurrent',
        ]))
        expect(ledger.filter(row => !row.dry_run && row.attempted_at)).toHaveLength(1)
    } finally {
        if (previousLive === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previousLive
    }
})

test('blocks a fresh send after five live failures while preceding dry runs consume no budget', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    const previousLive = process.env.DWM_WEBHOOK_LIVE_DELIVERY
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
    let networkAttempts = 0
    const sender = async () => {
        networkAttempts += 1
        return { status: 503, body: 'retry later' }
    }
    try {
        for (const actor of ['owner_1', 'member_2', 'owner_1']) {
            const result = await deliverDwmAlertNotification(actor, deliveryInput('checksum_budget', true), sender)
            expect(result[0]?.status).toBe('dry_run')
            expect(result[0]?.attemptCount).toBe(0)
        }
        const statuses: string[] = []
        for (let index = 0; index < 6; index += 1) {
            const actor = index % 2 === 0 ? 'owner_1' : 'member_2'
            const result = await deliverDwmAlertNotification(actor, deliveryInput('checksum_budget', false), sender)
            statuses.push(result[0]?.status)
        }
        expect(networkAttempts).toBe(5)
        expect(statuses).toEqual(['failed', 'failed', 'failed', 'failed', 'failed', 'skipped'])
        expect(ledger.filter(row => row.dry_run)).toHaveLength(3)
        expect(ledger.filter(row => !row.dry_run && row.attempted_at)).toHaveLength(5)
        expect(ledger.at(-1)).toMatchObject({
            status: 'skipped',
            attempt_count: 5,
            error_class: 'delivery_attempt_limit',
            attempted_at: null,
        })
    } finally {
        if (previousLive === undefined) delete process.env.DWM_WEBHOOK_LIVE_DELIVERY
        else process.env.DWM_WEBHOOK_LIVE_DELIVERY = previousLive
    }
})

function deliveryInput(dedupeKey: string, dryRun: boolean) {
    return {
        orgId: 'org_1',
        destinationId: 'destination_1',
        eventType: 'dwm.alert.updated',
        dryRun,
        live: true,
        alert: {
            id: 'alert_1',
            organizationId: 'org_1',
            tenantId: 'org_1',
            dedupeKey,
            title: 'Evidence-backed report delivery',
            firstSeenAt: '2026-07-23T10:00:00.000Z',
        },
    }
}

function reportDeliveryPayload() {
    const draft = {
        bundle: {
            type: 'bundle',
            id: 'bundle--11111111-1111-4111-8111-111111111111',
            objects: [
                { type: 'identity', spec_version: '2.1', id: 'identity--11111111-1111-4111-8111-111111111111' },
                { type: 'x-ti-evidence', spec_version: '2.1', id: 'x-ti-evidence--11111111-1111-4111-8111-111111111111', x_ti_capture_id: 'capture_1', x_ti_source_id: 'source_1', x_ti_content_hash: 'hash_1' },
                { type: 'report', spec_version: '2.1', id: 'report--11111111-1111-4111-8111-111111111111', published: '2026-07-24T10:00:00.000Z', object_refs: ['x-ti-evidence--11111111-1111-4111-8111-111111111111'] },
            ],
        },
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'stix-2.1',
            caseId: 'case_1',
            alertId: 'alert_1',
            organizationId: 'org_1',
            evidenceIds: ['evidence_1'],
            evidenceCount: 1,
        },
        standardsValidation: { standard: 'STIX 2.1', valid: true, issues: [] },
    }
    const exportChecksum = `case_report_${createHash('sha256').update(canonicalJson(draft)).digest('hex')}`
    const report = { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
    return {
        schemaVersion: 'dwm.webhook.v1',
        eventType: 'dwm.alert.updated',
        occurredAt: '2026-07-24T10:00:00.000Z',
        idempotencyKey: `dwm.alert.updated:org_1:destination_1:${exportChecksum}`,
        org: { id: 'org_1', tenantId: 'org_1' },
        destination: { id: 'destination_1', kind: 'webhook' },
        report,
        alert: { id: 'alert_1' },
        delivery: { id: 'delivery_receiver_1', eventType: 'dwm.alert.updated' },
    }
}

function failedDeliveryFixture(nextRetryAt: string) {
    const payload = {
        schemaVersion: 'dwm.webhook.v1',
        alert: { id: 'alert_1', title: 'Persisted delivery' },
        delivery: { dedupeKey: 'retry_fixture' },
    }
    return {
        id: 'failed_delivery_fixture',
        destination_id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        alert_id: 'alert_1',
        event_type: 'dwm.alert.updated',
        status: 'failed',
        dry_run: false,
        endpoint_hint: 'receiver.example/...',
        endpoint_hash: 'endpoint_hash',
        payload_hash: payloadHash(canonicalJson(payload)),
        payload,
        response_status: 503,
        response_body: 'retry later',
        error: 'Webhook returned HTTP 503.',
        error_class: 'upstream_5xx',
        attempt_count: 1,
        next_retry_at: nextRetryAt,
        idempotency_key: 'dwm.alert.updated:org_1:destination_1:retry_fixture',
        watchlist_id: null,
        watchlist_name: null,
        route: 'customer_webhook',
        case_path: '/dashboard/dwm/cases/case_1',
        attempted_at: '2020-07-23T10:00:00.000Z',
        completed_at: '2020-07-23T10:00:01.000Z',
        delivered_at: null,
        created_at: '2020-07-23T10:00:00.000Z',
    }
}

function payloadHash(body: string) {
    return `payload_${createHash('sha256').update(body).digest('hex').slice(0, 32)}`
}
