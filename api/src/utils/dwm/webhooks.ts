import crypto from 'node:crypto'
import run from '#db'
import { organizationVisibilityDecision, type OrganizationVisibilityDecisionInput } from '#utils/organizations.ts'

export type DwmWebhookKind = 'webhook' | 'discord'
export type DwmWebhookStatus = 'active' | 'paused' | 'archived'
export type DwmAlertEventType = 'dwm.alert.created' | 'dwm.alert.replayed' | 'dwm.alert.test'

export type DwmWebhookDestinationRow = {
    id: string
    owner_id: string
    org_id: string
    name: string
    kind: DwmWebhookKind
    endpoint_encrypted: string
    endpoint_hint: string
    endpoint_hash: string
    status: DwmWebhookStatus
    events: string[]
    created_by: string
    last_tested_at: string | null
    last_test_status: 'dry_run' | 'delivered' | 'failed' | 'skipped' | null
    last_test_error: string | null
    last_test_http_status: number | null
    last_delivery_at: string | null
    created_at: string
    updated_at: string
}

export type DwmWebhookDeliveryRow = {
    id: string
    destination_id: string | null
    owner_id: string
    org_id: string
    alert_id: string
    event_type: DwmAlertEventType
    status: 'dry_run' | 'delivered' | 'failed' | 'skipped'
    dry_run: boolean
    endpoint_hint: string
    endpoint_hash: string
    payload_hash: string
    payload: unknown
    response_status: number | null
    response_body: string | null
    error: string | null
    idempotency_key: string
    watchlist_id: string | null
    watchlist_name: string | null
    route: string | null
    case_path: string | null
    attempted_at: string
    created_at: string
}

export type DwmWebhookAuditRow = {
    id: string
    owner_id: string
    actor_id: string
    org_id: string
    destination_id: string | null
    delivery_id: string | null
    action: string
    metadata: unknown
    created_at: string
}

export type DwmWebhookDestinationInput = {
    orgId?: unknown
    name?: unknown
    kind?: unknown
    endpointUrl?: unknown
    endpoint_url?: unknown
    status?: unknown
    events?: unknown
}

export type DwmAlertNotificationInput = {
    orgId?: unknown
    organizationId?: unknown
    tenantId?: unknown
    destinationId?: unknown
    destination_id?: unknown
    eventType?: unknown
    event_type?: unknown
    alertId?: unknown
    watchlistItemId?: unknown
    watchlistId?: unknown
    watchlistName?: unknown
    dedupeKey?: unknown
    route?: unknown
    recommendedRoute?: unknown
    casePath?: unknown
    caseUrl?: unknown
    evidenceCount?: unknown
    sourceFamily?: unknown
    alert?: Record<string, unknown>
    dryRun?: unknown
    dry_run?: unknown
    live?: unknown
}

export type DwmAlertWebhookTriggerOptions = {
    eventType?: unknown
    destinationId?: unknown
    destination_id?: unknown
    dryRun?: unknown
    dry_run?: unknown
    live?: unknown
}

export type DwmWebhookDispatchDestination = Pick<DwmWebhookDestinationRow,
    'id' | 'org_id' | 'name' | 'kind' | 'status' | 'events'
>

export type DwmAlertWebhookDispatchPlan = {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    selectedDestinations: DwmWebhookDispatchDestination[]
    skippedDestinations: Array<{
        id: string
        orgId: string
        status: DwmWebhookStatus
        reason: 'org_mismatch' | 'disabled' | 'event_not_subscribed'
    }>
}

export type DwmWebhookDeliveryEvidenceFilters = {
    orgId?: unknown
    destinationId?: unknown
    alertId?: unknown
    casePath?: unknown
    dedupeKey?: unknown
}

export type DwmWebhookDeliveryAttemptState = 'queued' | 'sent' | 'failed' | 'skipped'

export type DwmWebhookEvidenceVisibilityInput = OrganizationVisibilityDecisionInput

type NormalizedDestinationInput = {
    orgId: string
    name: string
    kind: DwmWebhookKind
    endpointEncrypted: string | null
    endpointHint: string | null
    endpointHash: string | null
    status: DwmWebhookStatus
    events: DwmAlertEventType[]
}

const DEFAULT_EVENTS: DwmAlertEventType[] = ['dwm.alert.created', 'dwm.alert.replayed']
const EVENT_TYPES = new Set<DwmAlertEventType>(['dwm.alert.created', 'dwm.alert.replayed', 'dwm.alert.test'])
const DESTINATION_STATUSES = new Set<DwmWebhookStatus>(['active', 'paused', 'archived'])
const WEBHOOK_KINDS = new Set<DwmWebhookKind>(['webhook', 'discord'])
const SECRET_KEY_SOURCE = process.env.DWM_WEBHOOK_SECRET_KEY
    || process.env.MAIL_SERVICE_KEY
    || process.env.VM_API_TOKEN
    || process.env.DB_PASSWORD
    || 'hanasand-dwm-webhooks-development-key'
const SECRET_KEY = crypto.createHash('sha256').update(SECRET_KEY_SOURCE).digest()
const IV_LENGTH = 12
const DISCORD_CONTENT_LIMIT = 2000
const DISCORD_EMBED_TITLE_LIMIT = 256
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096
const DISCORD_EMBED_FIELD_NAME_LIMIT = 256
const DISCORD_EMBED_FIELD_VALUE_LIMIT = 1024
const DISCORD_EMBED_FIELD_LIMIT = 25
const DISCORD_EMBED_FOOTER_TEXT_LIMIT = 2048

export function toDwmWebhookDestination(row: DwmWebhookDestinationRow) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        orgId: row.org_id,
        name: row.name,
        kind: row.kind,
        endpointHint: row.endpoint_hint,
        endpointHash: row.endpoint_hash,
        status: row.status,
        events: row.events,
        createdBy: row.created_by,
        lastTestedAt: row.last_tested_at,
        lastTestStatus: row.last_test_status,
        lastTestError: row.last_test_error,
        lastTestHttpStatus: row.last_test_http_status,
        lastDeliveryAt: row.last_delivery_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export function toDwmWebhookDelivery(row: DwmWebhookDeliveryRow) {
    return {
        id: row.id,
        destinationId: row.destination_id,
        ownerId: row.owner_id,
        orgId: row.org_id,
        alertId: row.alert_id,
        eventType: row.event_type,
        status: row.status,
        dryRun: row.dry_run,
        endpointHint: row.endpoint_hint,
        endpointHash: row.endpoint_hash,
        payloadHash: row.payload_hash,
        payload: row.payload,
        responseStatus: row.response_status,
        responseBody: row.response_body,
        error: row.error,
        idempotencyKey: row.idempotency_key,
        watchlistId: row.watchlist_id,
        watchlistName: row.watchlist_name,
        route: row.route,
        casePath: row.case_path,
        attemptedAt: row.attempted_at,
        createdAt: row.created_at,
    }
}

export function toDwmWebhookAuditEvent(row: DwmWebhookAuditRow) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        actorId: row.actor_id,
        orgId: row.org_id,
        destinationId: row.destination_id,
        deliveryId: row.delivery_id,
        action: row.action,
        metadata: row.metadata,
        createdAt: row.created_at,
    }
}

type DwmWebhookDeliveryPublic = ReturnType<typeof toDwmWebhookDelivery>
type DwmWebhookAuditPublic = ReturnType<typeof toDwmWebhookAuditEvent>
type DwmWebhookDestinationPublic = ReturnType<typeof toDwmWebhookDestination>

export function normalizeDwmWebhookDestinationInput(
    input: DwmWebhookDestinationInput,
    ownerId: string,
    existing?: DwmWebhookDestinationRow
): NormalizedDestinationInput {
    const rawEndpoint = clean(input.endpointUrl ?? input.endpoint_url)
    const endpointUrl = rawEndpoint ? normalizeWebhookUrl(rawEndpoint) : null
    const kind = parseKind(input.kind, endpointUrl, existing?.kind)
    const name = clean(input.name) || existing?.name || (kind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
    const orgId = clean(input.orgId) || existing?.org_id || ownerId
    const status = parseStatus(input.status ?? existing?.status)
    const events = parseEvents(input.events ?? existing?.events)

    return {
        orgId,
        name: name.slice(0, 120),
        kind,
        endpointEncrypted: endpointUrl ? encryptWebhookSecret(endpointUrl) : null,
        endpointHint: endpointUrl ? redactWebhookEndpoint(endpointUrl) : null,
        endpointHash: endpointUrl ? hashValue('endpoint', endpointUrl) : null,
        status,
        events,
    }
}

export async function listDwmWebhookDestinations(ownerId: string, orgId?: string) {
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_destinations
            WHERE org_id = $1
              AND status <> 'archived'
            ORDER BY updated_at DESC, created_at DESC
        `, [orgId])

        return (result.rows as DwmWebhookDestinationRow[]).map(toDwmWebhookDestination)
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE owner_id = $1
          AND status <> 'archived'
          AND ($2::TEXT IS NULL OR org_id = $2)
        ORDER BY updated_at DESC, created_at DESC
    `, [ownerId, orgId || null])

    return (result.rows as DwmWebhookDestinationRow[]).map(toDwmWebhookDestination)
}

export async function createDwmWebhookDestination(ownerId: string, input: DwmWebhookDestinationInput) {
    const normalized = normalizeDwmWebhookDestinationInput(input, ownerId)
    if (!normalized.endpointEncrypted || !normalized.endpointHint) {
        throw new Error('endpointUrl is required.')
    }

    const result = await run(`
        INSERT INTO dwm_webhook_destinations (
            id,
            owner_id,
            org_id,
            name,
            kind,
            endpoint_encrypted,
            endpoint_hint,
            endpoint_hash,
            status,
            events,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::TEXT[], $11)
        RETURNING *
    `, [
        crypto.randomUUID(),
        ownerId,
        normalized.orgId,
        normalized.name,
        normalized.kind,
        normalized.endpointEncrypted,
        normalized.endpointHint,
        normalized.endpointHash,
        normalized.status,
        normalized.events,
        ownerId,
    ])

    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.created',
        metadata: {
            kind: destination.kind,
            endpointHint: destination.endpoint_hint,
            endpointHash: destination.endpoint_hash,
            events: destination.events,
            status: destination.status,
        },
    })

    return toDwmWebhookDestination(destination)
}

export async function updateDwmWebhookDestination(ownerId: string, id: string, input: DwmWebhookDestinationInput) {
    const existing = await loadDwmWebhookDestination(ownerId, id)
    if (!existing) return null

    const normalized = normalizeDwmWebhookDestinationInput(input, ownerId, existing)
    const result = await run(`
        UPDATE dwm_webhook_destinations
           SET org_id = $2,
               name = $3,
               kind = $4,
               endpoint_encrypted = COALESCE($5, endpoint_encrypted),
               endpoint_hint = COALESCE($6, endpoint_hint),
               endpoint_hash = COALESCE($7, endpoint_hash),
               status = $8,
               events = $9::TEXT[],
               updated_at = NOW()
         WHERE id = $1
         RETURNING *
    `, [
        id,
        normalized.orgId,
        normalized.name,
        normalized.kind,
        normalized.endpointEncrypted,
        normalized.endpointHint,
        normalized.endpointHash,
        normalized.status,
        normalized.events,
    ])

    if (!result.rows.length) return null

    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.updated',
        metadata: {
            kind: destination.kind,
            endpointHint: destination.endpoint_hint,
            endpointHash: destination.endpoint_hash,
            events: destination.events,
            status: destination.status,
        },
    })

    return toDwmWebhookDestination(destination)
}

export async function archiveDwmWebhookDestination(ownerId: string, id: string) {
    const existing = await loadDwmWebhookDestination(ownerId, id)
    if (!existing) return null

    const result = await run(`
        UPDATE dwm_webhook_destinations
           SET status = 'archived',
               updated_at = NOW()
         WHERE id = $1
           AND status <> 'archived'
         RETURNING *
    `, [id])

    if (!result.rows.length) return null

    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.archived',
        metadata: { endpointHint: destination.endpoint_hint, endpointHash: destination.endpoint_hash },
    })

    return toDwmWebhookDestination(destination)
}

export async function listDwmWebhookDeliveries(ownerId: string, orgId?: string) {
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_deliveries
            WHERE org_id = $1
            ORDER BY created_at DESC
            LIMIT 100
        `, [orgId])

        return (result.rows as DwmWebhookDeliveryRow[]).map(toDwmWebhookDelivery)
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE owner_id = $1
          AND ($2::TEXT IS NULL OR org_id = $2)
        ORDER BY created_at DESC
        LIMIT 100
    `, [ownerId, orgId || null])

    return (result.rows as DwmWebhookDeliveryRow[]).map(toDwmWebhookDelivery)
}

export async function listDwmWebhookAuditEvents(ownerId: string, orgId?: string) {
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_audit_events
            WHERE org_id = $1
            ORDER BY created_at DESC
            LIMIT 100
        `, [orgId])

        return (result.rows as DwmWebhookAuditRow[]).map(toDwmWebhookAuditEvent)
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_audit_events
        WHERE owner_id = $1
          AND ($2::TEXT IS NULL OR org_id = $2)
        ORDER BY created_at DESC
        LIMIT 100
    `, [ownerId, orgId || null])

    return (result.rows as DwmWebhookAuditRow[]).map(toDwmWebhookAuditEvent)
}

export function buildDwmWebhookDeliveryEvidence({
    deliveries,
    auditEvents = [],
    filters = {},
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
}) {
    const normalizedFilters = {
        orgId: clean(filters.orgId),
        destinationId: clean(filters.destinationId),
        alertId: clean(filters.alertId),
        casePath: clean(filters.casePath),
        dedupeKey: clean(filters.dedupeKey),
    }
    const auditByDelivery = new Map<string, DwmWebhookAuditPublic>()
    for (const audit of auditEvents) {
        if (audit.deliveryId && !auditByDelivery.has(audit.deliveryId)) {
            auditByDelivery.set(audit.deliveryId, audit)
        }
    }

    return deliveries
        .map((delivery) => {
            const payloadContext = extractHanasandPayloadContext(delivery.payload)
            const payloadAlert = recordOrEmpty(payloadContext.alert)
            const payloadDelivery = recordOrEmpty(payloadContext.delivery)
            const payloadWatchlist = recordOrEmpty(payloadContext.watchlist)
            const audit = auditByDelivery.get(delivery.id) || null
            const dedupeKey = clean(payloadDelivery.dedupeKey)
                || clean(payloadAlert.dedupeKey)
                || dedupeFromIdempotencyKey(delivery.idempotencyKey)
            const casePath = delivery.casePath || clean(payloadDelivery.casePath) || clean(payloadAlert.casePath)
            const replay = delivery.eventType === 'dwm.alert.replayed' || payloadDelivery.replay === true
            const liveRequested = !delivery.dryRun
            const live = liveRequested && delivery.status !== 'skipped'

            return {
                requestId: delivery.id,
                deliveryId: delivery.id,
                orgId: delivery.orgId,
                destinationId: delivery.destinationId,
                alertId: delivery.alertId,
                eventType: delivery.eventType,
                status: delivery.status,
                dryRun: delivery.dryRun,
                live,
                liveRequested,
                replay,
                replayCount: parseCount(payloadAlert.replayCount),
                route: delivery.route || clean(payloadDelivery.route) || clean(payloadAlert.route),
                casePath,
                dedupeKey,
                idempotencyKey: delivery.idempotencyKey,
                watchlistId: delivery.watchlistId || clean(payloadWatchlist.id),
                watchlistName: delivery.watchlistName || clean(payloadWatchlist.name),
                attemptedAt: delivery.attemptedAt,
                createdAt: delivery.createdAt,
                redactedDestination: {
                    id: delivery.destinationId,
                    endpointHint: redactDeliveryEvidenceText(delivery.endpointHint),
                    endpointHash: delivery.endpointHash,
                },
                payloadHash: delivery.payloadHash,
                response: {
                    httpStatus: delivery.responseStatus,
                    summary: delivery.responseBody ? redactDeliveryEvidenceText(truncate(delivery.responseBody, 500)) : null,
                },
                error: delivery.error ? redactDeliveryEvidenceText(truncate(delivery.error, 500)) : null,
                auditEventId: audit?.id || null,
                auditAction: audit?.action || null,
            }
        })
        .filter((evidence) => {
            if (normalizedFilters.orgId && evidence.orgId !== normalizedFilters.orgId) return false
            if (normalizedFilters.destinationId && evidence.destinationId !== normalizedFilters.destinationId) return false
            if (normalizedFilters.alertId && evidence.alertId !== normalizedFilters.alertId) return false
            if (normalizedFilters.casePath && evidence.casePath !== normalizedFilters.casePath) return false
            if (normalizedFilters.dedupeKey && evidence.dedupeKey !== normalizedFilters.dedupeKey && evidence.idempotencyKey !== normalizedFilters.dedupeKey) return false
            return true
        })
}

export function buildDwmWebhookDeliveryLedger({
    deliveries,
    auditEvents = [],
    filters = {},
    now = new Date(),
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    now?: Date
}) {
    const evidence = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters })
    const sortedDeliveries = [...deliveries].sort((a, b) => String(a.attemptedAt || a.createdAt).localeCompare(String(b.attemptedAt || b.createdAt)))
    const attemptCounts = new Map<string, number>()
    for (const delivery of sortedDeliveries) {
        const key = delivery.idempotencyKey || delivery.id
        attemptCounts.set(key, (attemptCounts.get(key) || 0) + 1)
    }

    return evidence.map((item) => {
        const delivery = deliveries.find(row => row.id === item.deliveryId)
        const retryPlan = delivery
            ? planDwmWebhookDeliveryRetry({
                status: delivery.status,
                dryRun: delivery.dryRun,
                responseStatus: delivery.responseStatus,
                error: delivery.error,
                attemptedAt: delivery.attemptedAt,
                attemptCount: attemptCounts.get(delivery.idempotencyKey || delivery.id) || 1,
                now,
            })
            : planDwmWebhookDeliveryRetry({
                status: item.status,
                dryRun: item.dryRun,
                responseStatus: item.response.httpStatus,
                error: item.error,
                attemptedAt: item.attemptedAt,
                attemptCount: 1,
                now,
            })
        const attemptCount = delivery ? attemptCounts.get(delivery.idempotencyKey || delivery.id) || 1 : 1

        return {
            requestId: item.requestId,
            deliveryId: item.deliveryId,
            destinationId: item.destinationId,
            orgId: item.orgId,
            alertId: item.alertId,
            eventType: item.eventType,
            status: deliveryAttemptState(item.status, item.dryRun),
            rawStatus: item.status,
            dryRun: item.dryRun,
            live: item.live,
            liveRequested: item.liveRequested,
            replay: item.replay,
            idempotencyKey: item.idempotencyKey,
            dedupeKey: item.dedupeKey,
            watchlistId: item.watchlistId,
            watchlistName: item.watchlistName,
            route: item.route,
            casePath: item.casePath,
            redactedEndpointLabel: item.redactedDestination.endpointHint,
            redactedDestination: item.redactedDestination,
            responseStatus: item.response.httpStatus,
            responseSummary: item.response.summary,
            error: item.error,
            errorClass: retryPlan.errorClass,
            attemptCount,
            attemptedAt: item.attemptedAt,
            createdAt: item.createdAt,
            nextRetryAt: retryPlan.nextRetryAt,
            retryable: retryPlan.retryable,
            retryReason: retryPlan.reason,
            payloadHash: item.payloadHash,
            auditEventId: item.auditEventId,
            auditAction: item.auditAction,
        }
    })
}

export function planDwmWebhookDeliveryRetry({
    status,
    dryRun,
    responseStatus,
    error,
    attemptedAt,
    attemptCount = 1,
    now = new Date(),
}: {
    status: DwmWebhookDeliveryPublic['status']
    dryRun: boolean
    responseStatus?: number | null
    error?: string | null
    attemptedAt?: string | null
    attemptCount?: number
    now?: Date
}) {
    const errorClass = classifyDeliveryError({ status, dryRun, responseStatus, error })
    if (dryRun) {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'dry_run_no_external_send' }
    }
    if (status === 'delivered') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'already_sent' }
    }
    if (status === 'skipped') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: errorClass === 'live_delivery_disabled' ? 'live_delivery_disabled' : 'skipped_not_retryable' }
    }
    if (status !== 'failed') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'not_failed' }
    }
    if (responseStatus && responseStatus >= 400 && responseStatus < 500 && responseStatus !== 408 && responseStatus !== 429) {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'non_retryable_http_status' }
    }

    const base = attemptedAt ? new Date(attemptedAt) : now
    const retryMs = retryDelayMs(attemptCount)
    const nextRetryAt = new Date(base.getTime() + retryMs).toISOString()
    return {
        retryable: true,
        nextRetryAt,
        errorClass,
        reason: responseStatus === 429 ? 'rate_limited' : responseStatus && responseStatus >= 500 ? 'upstream_retryable' : 'network_retryable',
    }
}

export function filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence,
    visibility,
}: {
    evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>
    visibility: DwmWebhookEvidenceVisibilityInput
}) {
    const decision = organizationVisibilityDecision(visibility)
    return {
        decision,
        deliveryEvidence: decision.allowed ? evidence : [],
    }
}

export function buildDwmWebhookDestinationContracts({
    destinations,
    deliveries = [],
    auditEvents = [],
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
}) {
    return destinations.map((destination) => {
        const destinationDeliveries = deliveries
            .filter(delivery => delivery.destinationId === destination.id)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const destinationAudits = auditEvents
            .filter(audit => audit.destinationId === destination.id)
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const lastTestDelivery = destinationDeliveries.find(delivery => delivery.eventType === 'dwm.alert.test')
        const lastDelivery = destinationDeliveries.find(delivery => delivery.eventType !== 'dwm.alert.test')
        const testAudit = lastTestDelivery ? destinationAudits.find(audit => audit.deliveryId === lastTestDelivery.id) : null
        const deliveryAudit = lastDelivery ? destinationAudits.find(audit => audit.deliveryId === lastDelivery.id) : null
        const failureReason = redactNullableDeliveryText(destination.lastTestError || lastDelivery?.error || lastTestDelivery?.error || null)

        return {
            id: destination.id,
            orgId: destination.orgId,
            type: destination.kind,
            kind: destination.kind,
            label: destination.name,
            name: destination.name,
            status: destination.status,
            enabled: destination.status === 'active',
            events: destination.events,
            redactedUrl: redactDeliveryEvidenceText(destination.endpointHint),
            redactedDestination: {
                endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                endpointHash: destination.endpointHash,
            },
            createdBy: destination.createdBy,
            actorId: destination.createdBy,
            lastTest: {
                at: destination.lastTestedAt || lastTestDelivery?.attemptedAt || null,
                status: destination.lastTestStatus || lastTestDelivery?.status || null,
                httpStatus: destination.lastTestHttpStatus || lastTestDelivery?.responseStatus || null,
                failureReason: redactNullableDeliveryText(destination.lastTestError || lastTestDelivery?.error || null),
                requestId: lastTestDelivery?.id || null,
                auditEventId: testAudit?.id || null,
            },
            lastDelivery: {
                at: destination.lastDeliveryAt || lastDelivery?.attemptedAt || null,
                status: lastDelivery?.status || null,
                requestId: lastDelivery?.id || null,
                auditEventId: deliveryAudit?.id || null,
                failureReason: redactNullableDeliveryText(lastDelivery?.error || null),
            },
            failureReason,
            latestAuditEventId: destinationAudits[0]?.id || null,
            auditEventIds: destinationAudits.map(audit => audit.id),
            createdAt: destination.createdAt,
            updatedAt: destination.updatedAt,
        }
    })
}

export function buildDwmWebhookDeliveryReadiness({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const destinationContracts = buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const attemptsByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = attemptsByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        attemptsByDestination.set(attempt.destinationId, attempts)
    }
    const destinationReadiness = destinationContracts.map((destination) => {
        const attempts = (attemptsByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = attempts[0] || null
        const blockers = destinationReadinessBlockers({ destination, latestAttempt, liveDeliveryEnabled })
        const ready = blockers.filter(blocker => blocker !== 'live_delivery_disabled').length === 0
        const retryState = latestAttempt
            ? {
                retryable: latestAttempt.retryable,
                nextRetryAt: latestAttempt.nextRetryAt,
                errorClass: latestAttempt.errorClass,
                reason: latestAttempt.retryReason,
                attemptCount: latestAttempt.attemptCount,
            }
            : { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 }

        return {
            destinationId: destination.id,
            orgId: destination.orgId,
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            ready,
            readiness: ready ? 'ready' : latestAttempt?.retryable ? 'retrying' : destination.enabled ? 'blocked' : 'disabled',
            redactedEndpoint: destination.redactedDestination,
            lastTest: destination.lastTest,
            lastDelivery: destination.lastDelivery,
            retryState,
            failureClass: retryState.errorClass,
            blockers,
            idempotencyCoverage: idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
        }
    })
    const blockers = [...new Set(destinationReadiness.flatMap(destination => destination.blockers))]
    const recentAttempts = [...deliveryLedger]
        .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        .slice(0, 10)

    return {
        schemaVersion: 'dwm.webhook.readiness.v1',
        liveDeliveryEnabled,
        destinationCount: destinationReadiness.length,
        activeDestinationCount: destinationReadiness.filter(destination => destination.enabled).length,
        readyDestinationCount: destinationReadiness.filter(destination => destination.ready).length,
        disabledDestinationCount: destinationReadiness.filter(destination => !destination.enabled).length,
        retryScheduledCount: destinationReadiness.filter(destination => destination.retryState.retryable).length,
        failedDestinationCount: destinationReadiness.filter(destination => destination.failureClass && !destination.retryState.retryable).length,
        blockers,
        destinations: destinationReadiness,
        recentAttempts,
        idempotencyCoverage: idempotencyCoverage(deliveryLedger),
    }
}

export function buildDwmWebhookDeliveryPreview(delivery: DwmWebhookDeliveryPublic) {
    const context = extractHanasandPayloadContext(delivery.payload)
    const payloadAlert = recordOrEmpty(context.alert)
    const payloadWatchlist = recordOrEmpty(context.watchlist)
    const payloadDelivery = recordOrEmpty(context.delivery)
    const embeds = Array.isArray((delivery.payload as Record<string, unknown> | undefined)?.embeds)
        ? (delivery.payload as Record<string, unknown>).embeds
        : []

    return {
        requestId: delivery.id,
        status: delivery.status,
        dryRun: delivery.dryRun,
        live: !delivery.dryRun && delivery.status !== 'skipped',
        destination: {
            id: delivery.destinationId,
            endpointHint: redactDeliveryEvidenceText(delivery.endpointHint),
            endpointHash: delivery.endpointHash,
        },
        payload: delivery.payload,
        discord: {
            content: clean((delivery.payload as Record<string, unknown> | undefined)?.content),
            embeds,
            allowedMentions: (delivery.payload as Record<string, unknown> | undefined)?.allowed_mentions || null,
        },
        context: {
            org: recordOrEmpty(context.org),
            watchlist: payloadWatchlist,
            alert: {
                id: clean(payloadAlert.id) || delivery.alertId,
                title: clean(payloadAlert.title),
                severity: clean(payloadAlert.severity),
                sourceFamily: clean(payloadAlert.sourceFamily),
                evidenceCount: parseCount(payloadAlert.evidenceCount),
                provenance: payloadAlert.provenance || null,
                dedupeKey: clean(payloadAlert.dedupeKey) || clean(payloadDelivery.dedupeKey) || dedupeFromIdempotencyKey(delivery.idempotencyKey),
                casePath: clean(payloadAlert.casePath) || clean(payloadDelivery.casePath) || delivery.casePath,
                alertUrl: clean(payloadAlert.alertUrl) || clean(payloadDelivery.alertUrl),
                caseId: clean(payloadAlert.caseId) || clean(payloadAlert.caseIdCandidate),
            },
            delivery: payloadDelivery,
            links: {
                casePath: clean(payloadDelivery.casePath) || clean(payloadAlert.casePath) || delivery.casePath,
                alertUrl: clean(payloadDelivery.alertUrl) || clean(payloadAlert.alertUrl),
            },
        },
        response: {
            httpStatus: delivery.responseStatus,
            summary: delivery.responseBody ? redactDeliveryEvidenceText(truncate(delivery.responseBody, 500)) : null,
        },
        error: delivery.error ? redactDeliveryEvidenceText(truncate(delivery.error, 500)) : null,
        payloadHash: delivery.payloadHash,
        idempotencyKey: delivery.idempotencyKey,
    }
}

export async function testDwmWebhookDestination(ownerId: string, id: string, input: DwmAlertNotificationInput = {}) {
    const destination = await loadDwmWebhookDestination(ownerId, id)
    if (!destination || destination.status === 'archived') return null

    const delivery = await deliverToDwmWebhookDestination({
        ownerId,
        destination,
        eventType: 'dwm.alert.test',
        alert: buildTestAlert(destination),
        dryRun: parseBoolean(input.dryRun ?? input.dry_run, true),
        live: parseBoolean(input.live, false),
        markTested: true,
    })

    return delivery
}

export async function deliverDwmAlertNotification(ownerId: string, input: DwmAlertNotificationInput) {
    const dispatch = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input,
        destinations: [],
    })
    const destinationId = clean(input.destinationId ?? input.destination_id)
    const dryRun = parseBoolean(input.dryRun ?? input.dry_run, true)
    const live = parseBoolean(input.live, false)
    const destination = destinationId ? await loadDwmWebhookDestination(ownerId, destinationId) : null
    const candidateDestinations = destinationId
        ? (destination ? [destination] : [])
        : await loadDestinationsForOrg(ownerId, dispatch.orgId)
    const plan = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input,
        destinations: candidateDestinations,
    })

    const deliveries = []
    for (const destination of plan.selectedDestinations) {
        deliveries.push(await deliverToDwmWebhookDestination({
            ownerId,
            destination: destination as DwmWebhookDestinationRow,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            live,
            markTested: false,
        }))
    }

    return deliveries
}

export function buildDwmAlertWebhookNotificationInput(
    alert: Record<string, unknown>,
    options: DwmAlertWebhookTriggerOptions = {}
): DwmAlertNotificationInput {
    const workflowContext = recordOrEmpty(alert.workflowContext)
    const webhookContext = recordOrEmpty(alert.webhookContext)
    const matchedTerm = normalizeMatchedTerm(alert.matchedTerm || workflowContext.matchedTerm)
    const watchlistIds = [
        ...cleanList(alert.watchlistItemIds),
        ...cleanList(webhookContext.watchlistItemIds),
        ...cleanList(workflowContext.watchlistItemIds),
        ...cleanList(alert.watchlistIds),
        ...cleanList(webhookContext.watchlistIds),
        ...cleanList(workflowContext.watchlistIds),
    ]
    const orgId = firstClean(
        alert.organizationId,
        alert.orgId,
        webhookContext.organizationId,
        workflowContext.organizationId,
        alert.tenantId,
        webhookContext.tenantId,
        workflowContext.tenantId
    )
    const tenantId = firstClean(alert.tenantId, webhookContext.tenantId, workflowContext.tenantId)
    const watchlistRecord = recordOrEmpty(alert.watchlist)
    const watchlistId = firstClean(watchlistRecord.id, alert.watchlistItemId, alert.watchlistId, watchlistIds[0])
    const watchlistName = firstClean(watchlistRecord.name, alert.watchlistName, webhookContext.watchlistName, workflowContext.watchlistName)
    const watchlistTerms = cleanList(watchlistRecord.terms)
    const dedupeKey = firstClean(
        alert.dedupeKey,
        webhookContext.dedupeKey,
        workflowContext.dedupeKey,
        recordOrEmpty(alert.webhookDelivery).dedupeKey,
        alert.id,
        webhookContext.alertId
    )
    const route = firstClean(
        alert.route,
        alert.recommendedRoute,
        webhookContext.recommendedRoute,
        workflowContext.recommendedRoute,
        recordOrEmpty(alert.webhookDelivery).recommendedRoute
    )
    const casePath = firstClean(alert.casePath, alert.caseUrl, webhookContext.casePath, workflowContext.casePath)
    const alertUrl = firstClean(alert.alertUrl, alert.alertURL, alert.deepLink, alert.url, webhookContext.alertUrl, webhookContext.deepLink, workflowContext.alertUrl, workflowContext.deepLink)
    const caseId = firstClean(alert.caseId, alert.caseIdCandidate, webhookContext.caseIdCandidate, workflowContext.caseIdCandidate)
    const evidenceCount = parseCount(alert.evidenceCount ?? webhookContext.evidenceCount ?? workflowContext.evidenceCount)
    const sourceFamily = firstClean(alert.sourceFamily, webhookContext.sourceFamily, workflowContext.sourceFamily)
    const provenance = alert.provenance || webhookContext.provenance || {
        captureIds: cleanList(webhookContext.captureIds).length ? cleanList(webhookContext.captureIds) : cleanList(workflowContext.captureIds),
        primaryCaptureId: firstClean(webhookContext.primaryCaptureId, workflowContext.primaryCaptureId),
    }

    return {
        orgId,
        organizationId: orgId,
        tenantId,
        destinationId: firstClean(options.destinationId, options.destination_id),
        eventType: parseEventType(options.eventType, parseEventType(webhookContext.eventType || alert.eventType, 'dwm.alert.created')),
        alertId: firstClean(alert.id, webhookContext.alertId),
        watchlistItemId: watchlistId,
        watchlistId,
        watchlistName,
        dedupeKey,
        route,
        recommendedRoute: route,
        casePath,
        evidenceCount,
        sourceFamily,
        dryRun: options.dryRun ?? options.dry_run,
        live: options.live,
        alert: {
            ...alert,
            id: firstClean(alert.id, webhookContext.alertId),
            organizationId: orgId,
            tenantId,
            watchlist: {
                ...watchlistRecord,
                id: watchlistId,
                name: watchlistName,
                terms: watchlistTerms.length ? watchlistTerms : [matchedTerm.value].filter(Boolean),
            },
            matchedTerm,
            sourceFamily,
            evidenceCount,
            dedupeKey,
            route,
            recommendedRoute: route,
            casePath,
            alertUrl,
            caseId,
            provenance,
        },
    }
}

export function buildDwmWebhookDeliveryRequestInput(input: DwmAlertNotificationInput): DwmAlertNotificationInput {
    const alert = input.alert && typeof input.alert === 'object' ? input.alert : null
    if (!alert) return input

    const normalized = buildDwmAlertWebhookNotificationInput(alert, {
        eventType: input.eventType ?? input.event_type,
        destinationId: input.destinationId ?? input.destination_id,
        dryRun: input.dryRun ?? input.dry_run,
        live: input.live,
    })
    const orgId = firstClean(input.orgId, input.organizationId, input.tenantId, normalized.orgId, normalized.organizationId, normalized.tenantId)

    return {
        ...input,
        ...normalized,
        orgId,
        organizationId: orgId,
    }
}

export async function triggerDwmAlertWebhookNotification(
    ownerId: string,
    alert: Record<string, unknown>,
    options: DwmAlertWebhookTriggerOptions = {}
) {
    return deliverDwmAlertNotification(ownerId, buildDwmAlertWebhookNotificationInput(alert, options))
}

export function buildDwmAlertWebhookDispatchPlan({
    ownerId,
    input,
    destinations,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDispatchDestination[]
}): DwmAlertWebhookDispatchPlan {
    const eventType = parseEventType(input.eventType ?? input.event_type, 'dwm.alert.created')
    const alert = normalizeDispatchAlertInput(input)
    const orgId = clean(input.orgId)
        || clean(input.organizationId)
        || clean(input.tenantId)
        || clean(alert.organizationId)
        || clean(alert.orgId)
        || clean(alert.tenantId)
        || ownerId
    const selectedDestinations: DwmWebhookDispatchDestination[] = []
    const skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations'] = []

    for (const destination of destinations) {
        if (destination.org_id !== orgId) {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'org_mismatch' })
            continue
        }
        if (destination.status !== 'active') {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'disabled' })
            continue
        }
        if (!destination.events.includes(eventType)) {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'event_not_subscribed' })
            continue
        }
        selectedDestinations.push(destination)
    }

    return {
        ownerId,
        orgId,
        eventType,
        alert,
        selectedDestinations,
        skippedDestinations,
    }
}

export function buildDwmAlertDeliveryPayload({
    destination,
    alert,
    eventType,
    deliveryId = crypto.randomUUID(),
}: {
    destination: Pick<DwmWebhookDestinationRow, 'id' | 'kind' | 'name' | 'org_id'>
    alert: Record<string, unknown>
    eventType: DwmAlertEventType
    deliveryId?: string
}) {
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const displayDedupeKey = normalizedAlert.dedupeKey || idempotencyKey
    const context = {
        schemaVersion: 'dwm.webhook.v1',
        eventType,
        occurredAt: new Date().toISOString(),
        idempotencyKey,
        org: {
            id: destination.org_id,
            name: clean(alert.orgName) || clean(alert.organizationName) || destination.org_id,
        },
        destination: {
            id: destination.id,
            name: destination.name,
            kind: destination.kind,
        },
        alert: normalizedAlert,
        watchlist,
        delivery: {
            id: deliveryId,
            replay: eventType === 'dwm.alert.replayed',
            dryRunDefault: true,
            route: normalizedAlert.route,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            dedupeKey: displayDedupeKey,
        },
    }

    if (destination.kind !== 'discord') {
        return context
    }

    return {
        content: discordText(`${severityEmoji(normalizedAlert.severity)} ${normalizedAlert.title}`, DISCORD_CONTENT_LIMIT),
        allowed_mentions: { parse: [] },
        embeds: [
            {
                title: discordText(normalizedAlert.title, DISCORD_EMBED_TITLE_LIMIT),
                description: discordText(normalizedAlert.claimSummary, DISCORD_EMBED_DESCRIPTION_LIMIT),
                color: severityColor(normalizedAlert.severity),
                timestamp: normalizedAlert.firstSeenAt || context.occurredAt,
                fields: [
                    discordField('Organization', context.org.name, true),
                    discordField('Severity', normalizedAlert.severity.toUpperCase(), true),
                    discordField('Company / domain', normalizedAlert.companyOrDomain || normalizedAlert.matchedTerm.value || 'Not provided', true),
                    watchlist.name || watchlist.terms.length ? discordField('Watchlist', [watchlist.name, watchlist.terms[0]].filter(Boolean).join(' | '), true) : null,
                    discordField('Source family', normalizedAlert.sourceFamily || 'Unknown', true),
                    discordField('Evidence count', String(normalizedAlert.evidenceCount), true),
                    normalizedAlert.evidenceSummary ? discordField('Evidence summary', normalizedAlert.evidenceSummary, false) : null,
                    discordField('Route', normalizedAlert.route, true),
                    discordField('Dedupe key', displayDedupeKey, false),
                    normalizedAlert.caseId ? discordField('Case ID', normalizedAlert.caseId, true) : null,
                    normalizedAlert.casePath ? discordField('Case', normalizedAlert.casePath, false) : null,
                    normalizedAlert.alertUrl ? discordField('Alert URL', normalizedAlert.alertUrl, false) : null,
                    normalizedAlert.provenanceSummary ? discordField('Provenance', normalizedAlert.provenanceSummary, false) : null,
                    discordField('Recommended action', normalizedAlert.recommendedAction, false),
                ].filter(Boolean).slice(0, DISCORD_EMBED_FIELD_LIMIT),
                footer: {
                    text: discordText(`Hanasand DWM ${eventType.replace('dwm.alert.', '')} | ${normalizedAlert.id} | ${watchlist.id || 'no-watchlist'}`, DISCORD_EMBED_FOOTER_TEXT_LIMIT),
                },
            },
        ],
        _hanasand: context,
    }
}

function discordField(name: string, value: string, inline: boolean) {
    return {
        name: discordText(name, DISCORD_EMBED_FIELD_NAME_LIMIT),
        value: discordText(value || 'Not provided', DISCORD_EMBED_FIELD_VALUE_LIMIT),
        inline,
    }
}

function discordText(value: string, max: number) {
    const text = clean(value) || 'Not provided'
    return truncate(text, max)
}

export function redactWebhookEndpoint(endpointUrl: string) {
    try {
        const url = new URL(endpointUrl)
        url.username = ''
        url.password = ''
        if (isDiscordWebhookUrl(url)) {
            const parts = url.pathname.split('/').filter(Boolean)
            const webhookId = parts[2] || 'unknown'
            return `${url.origin}/api/webhooks/${webhookId}/...`
        }
        const suffix = url.pathname.length > 1 ? `${url.pathname.slice(0, 24)}${url.pathname.length > 24 ? '...' : ''}` : ''
        return `${url.origin}${suffix}`
    } catch {
        return 'redacted-webhook'
    }
}

async function deliverToDwmWebhookDestination({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    live,
    markTested,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    live: boolean
    markTested: boolean
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination, alert, eventType, deliveryId })
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const payloadHash = hashValue('payload', JSON.stringify(payload))
    const shouldSendLive = live && !dryRun && process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true'
    let status: DwmWebhookDeliveryRow['status'] = dryRun ? 'dry_run' : 'skipped'
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let error: string | null = null

    if (!dryRun && live && process.env.DWM_WEBHOOK_LIVE_DELIVERY !== 'true') {
        error = 'Live DWM webhook delivery is disabled. Set DWM_WEBHOOK_LIVE_DELIVERY=true and send live=true to enable external calls.'
    }

    if (shouldSendLive) {
        try {
            const endpoint = decryptWebhookSecret(destination.endpoint_encrypted)
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'hanasand-dwm-webhooks/1.0',
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(Number(process.env.DWM_WEBHOOK_TIMEOUT_MS || 8000)),
            })
            responseStatus = response.status
            responseBody = truncate(await response.text().catch(() => ''), 2000)
            status = response.ok ? 'delivered' : 'failed'
            error = response.ok ? null : `Webhook returned HTTP ${response.status}.`
        } catch (sendError) {
            status = 'failed'
            error = sendError instanceof Error ? sendError.message : String(sendError)
        }
    }

    const result = await run(`
        INSERT INTO dwm_webhook_deliveries (
            id,
            destination_id,
            owner_id,
            org_id,
            alert_id,
            event_type,
            status,
            dry_run,
            endpoint_hint,
            endpoint_hash,
            payload_hash,
            payload,
            response_status,
            response_body,
            error,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::JSONB, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
        RETURNING *
    `, [
        deliveryId,
        destination.id,
        ownerId,
        destination.org_id,
        normalizedAlert.id,
        eventType,
        status,
        dryRun,
        destination.endpoint_hint,
        destination.endpoint_hash,
        payloadHash,
        JSON.stringify(payload),
        responseStatus,
        responseBody,
        error,
        buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
        watchlist.id,
        watchlist.name,
        normalizedAlert.route,
        normalizedAlert.casePath,
    ])

    if (status === 'delivered' || status === 'dry_run' || markTested) {
        await run(`
            UPDATE dwm_webhook_destinations
               SET last_tested_at = CASE WHEN $2 THEN NOW() ELSE last_tested_at END,
                   last_test_status = CASE WHEN $2 THEN $3 ELSE last_test_status END,
                   last_test_error = CASE WHEN $2 THEN $4 ELSE last_test_error END,
                   last_test_http_status = CASE WHEN $2 THEN $5 ELSE last_test_http_status END,
                   last_delivery_at = CASE WHEN $6 THEN NOW() ELSE last_delivery_at END,
                   updated_at = NOW()
             WHERE id = $1
        `, [destination.id, markTested, status, error, responseStatus, status === 'delivered'])
    }

    const delivery = result.rows[0] as DwmWebhookDeliveryRow
    const auditAction = markTested
        ? 'delivery.tested'
        : delivery.event_type === 'dwm.alert.replayed'
            ? 'delivery.replayed'
            : `delivery.${delivery.status}`
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: destination.id,
        deliveryId: delivery.id,
        action: auditAction,
        metadata: {
            alertId: delivery.alert_id,
            eventType: delivery.event_type,
            status: delivery.status,
            endpointHint: delivery.endpoint_hint,
            endpointHash: delivery.endpoint_hash,
            payloadHash: delivery.payload_hash,
            dryRun: delivery.dry_run,
            responseStatus: delivery.response_status,
            error: delivery.error,
            idempotencyKey: delivery.idempotency_key,
            watchlistId: delivery.watchlist_id,
            route: delivery.route,
            casePath: delivery.case_path,
        },
    })

    return toDwmWebhookDelivery(delivery)
}

async function recordDwmWebhookAudit({
    ownerId,
    actorId,
    orgId,
    destinationId = null,
    deliveryId = null,
    action,
    metadata = {},
}: {
    ownerId: string
    actorId: string
    orgId: string
    destinationId?: string | null
    deliveryId?: string | null
    action: string
    metadata?: Record<string, unknown>
}) {
    await run(`
        INSERT INTO dwm_webhook_audit_events (
            id,
            owner_id,
            actor_id,
            org_id,
            destination_id,
            delivery_id,
            action,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB)
    `, [
        crypto.randomUUID(),
        ownerId,
        actorId,
        orgId,
        destinationId,
        deliveryId,
        action,
        JSON.stringify(redactAuditMetadata(metadata)),
    ])
}

async function loadDwmWebhookDestination(ownerId: string, id: string) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE id = $1
          AND (
              owner_id = $2
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $2
                    AND status = 'active'
              )
          )
    `, [id, ownerId])

    return (result.rows as DwmWebhookDestinationRow[])[0] || null
}

async function loadDestinationsForOrg(ownerId: string, orgId: string) {
    if (orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_destinations
            WHERE org_id = $1
              AND status <> 'archived'
            ORDER BY created_at ASC
        `, [orgId])

        return result.rows as DwmWebhookDestinationRow[]
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE owner_id = $1
          AND org_id = $2
          AND status <> 'archived'
        ORDER BY created_at ASC
    `, [ownerId, orgId])

    return result.rows as DwmWebhookDestinationRow[]
}

function normalizeWebhookUrl(raw: string) {
    let url
    try {
        url = new URL(raw)
    } catch {
        throw new Error('endpointUrl must be a valid URL.')
    }

    if (url.protocol !== 'https:') {
        throw new Error('Webhook destinations must use HTTPS.')
    }

    return url.toString()
}

function parseKind(value: unknown, endpointUrl?: string | null, fallback?: DwmWebhookKind): DwmWebhookKind {
    const raw = clean(value)
    if (WEBHOOK_KINDS.has(raw as DwmWebhookKind)) return raw as DwmWebhookKind
    if (endpointUrl) {
        try {
            return isDiscordWebhookUrl(new URL(endpointUrl)) ? 'discord' : 'webhook'
        } catch {
            return 'webhook'
        }
    }
    return fallback || 'webhook'
}

function parseStatus(value: unknown): DwmWebhookStatus {
    const status = clean(value)
    return DESTINATION_STATUSES.has(status as DwmWebhookStatus) ? status as DwmWebhookStatus : 'active'
}

function parseEvents(value: unknown): DwmAlertEventType[] {
    if (!Array.isArray(value)) return DEFAULT_EVENTS
    const events = [...new Set(value.map(clean).filter(event => EVENT_TYPES.has(event as DwmAlertEventType)))] as DwmAlertEventType[]
    return events.length ? events : DEFAULT_EVENTS
}

function parseEventType(value: unknown, fallback: DwmAlertEventType): DwmAlertEventType {
    const event = clean(value)
    return EVENT_TYPES.has(event as DwmAlertEventType) ? event as DwmAlertEventType : fallback
}

function parseBoolean(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
        if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
        if (['false', '0', 'no'].includes(value.toLowerCase())) return false
    }
    return fallback
}

function parseCount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed)
    }
    return 0
}

function normalizeDispatchAlertInput(input: DwmAlertNotificationInput) {
    const nested = input.alert && typeof input.alert === 'object' ? input.alert : {}
    const watchlist = nested.watchlist && typeof nested.watchlist === 'object'
        ? nested.watchlist
        : {
            id: clean(input.watchlistItemId) || clean(input.watchlistId),
            name: clean(input.watchlistName),
            terms: [],
        }

    return {
        ...input,
        ...nested,
        id: clean(nested.id) || clean(input.alertId) || clean((input as Record<string, unknown>).id),
        organizationId: clean(nested.organizationId) || clean(input.organizationId) || clean(input.orgId),
        tenantId: clean(nested.tenantId) || clean(input.tenantId),
        watchlist,
        dedupeKey: clean(nested.dedupeKey) || clean(input.dedupeKey) || clean((nested.webhookDelivery as Record<string, unknown> | undefined)?.dedupeKey),
        route: clean(nested.route) || clean(input.route) || clean(input.recommendedRoute),
        recommendedRoute: clean(nested.recommendedRoute) || clean(input.recommendedRoute) || clean(input.route),
        casePath: clean(nested.casePath) || clean(input.casePath) || clean(input.caseUrl),
        evidenceCount: parseCount(nested.evidenceCount ?? input.evidenceCount),
        sourceFamily: clean(nested.sourceFamily) || clean(input.sourceFamily),
    }
}

function normalizeAlert(alert: Record<string, unknown>) {
    const matchedTerm = normalizeMatchedTerm(alert.matchedTerm)
    const company = clean(alert.company) || clean(alert.organizationName) || clean(alert.orgName)
    const domain = clean(alert.domain) || (matchedTerm.kind === 'domain' ? matchedTerm.value : '')
    const id = clean(alert.id) || `dwm-alert-${crypto.randomUUID()}`
    const title = clean(alert.title)
        || (company && matchedTerm.value ? `${company} matched ${matchedTerm.value}` : '')
        || 'Dark web monitoring alert'
    const severity = parseSeverity(alert.severity)
    const evidence = normalizeEvidence(alert.evidence)
    const evidenceCount = parseCount(alert.evidenceCount)
    const route = clean(alert.route)
        || clean(alert.recommendedRoute)
        || clean((alert.webhookDelivery as Record<string, unknown> | undefined)?.recommendedRoute)
        || 'customer_webhook'
    const casePath = clean(alert.casePath)
        || clean(alert.caseUrl)
        || clean(alert.path)
        || (id === 'webhook_test' ? '/dashboard/dwm' : `/dashboard/dwm?alert=${encodeURIComponent(id)}`)
    const alertUrl = clean(alert.alertUrl)
        || clean(alert.alertURL)
        || clean(alert.deepLink)
        || clean(alert.url)
        || clean(alert.caseUrl)
        || (casePath.startsWith('http://') || casePath.startsWith('https://') ? casePath : '')

    return {
        id,
        title,
        severity,
        company,
        domain,
        companyOrDomain: company || domain || matchedTerm.value,
        claimSummary: clean(alert.claimSummary) || clean(alert.summary) || 'A watched organization or asset matched newly collected threat intelligence.',
        recommendedAction: clean(alert.recommendedAction) || 'Review the evidence, validate the match, and contact the affected owner if exposure is confirmed.',
        matchedTerm,
        sourceFamily: clean(alert.sourceFamily) || clean(alert.source) || 'dark_web',
        artifactType: clean(alert.artifactType) || clean(alert.type) || 'mention',
        firstSeenAt: clean(alert.firstSeenAt) || clean(alert.createdAt) || new Date().toISOString(),
        savedAt: clean(alert.savedAt) || null,
        reviewState: clean(alert.reviewState) || 'needs_review',
        deliveryState: clean(alert.deliveryState) || 'pending_review',
        route,
        casePath,
        alertUrl,
        caseId: clean(alert.caseId) || clean(alert.caseIdCandidate) || clean((alert.workflowContext as Record<string, unknown> | undefined)?.caseIdCandidate),
        evidence,
        evidenceCount: evidence.length || evidenceCount,
        evidenceSummary: summarizeEvidence(evidence),
        dedupeKey: clean(alert.dedupeKey) || clean((alert.webhookDelivery as Record<string, unknown> | undefined)?.dedupeKey),
        provenance: alert.provenance || null,
        provenanceSummary: provenanceSummary(alert.provenance),
    }
}

function normalizeMatchedTerm(value: unknown) {
    if (!value || typeof value !== 'object') {
        return { value: clean(value) || '', kind: 'unknown' }
    }
    const record = value as Record<string, unknown>
    return {
        value: clean(record.value) || clean(record.term) || '',
        kind: clean(record.kind) || 'unknown',
    }
}

function normalizeWatchlist(value: unknown) {
    if (!value || typeof value !== 'object') {
        return { id: null, name: null, terms: [] as string[] }
    }
    const record = value as Record<string, unknown>
    const terms = Array.isArray(record.terms)
        ? record.terms.map(term => typeof term === 'string' ? term : clean((term as Record<string, unknown>)?.value)).filter(Boolean).slice(0, 20)
        : []

    return {
        id: clean(record.id) || null,
        name: clean(record.name) || null,
        terms,
    }
}

function normalizeEvidence(value: unknown) {
    if (!Array.isArray(value)) return []
    return value
        .slice(0, 6)
        .map(item => typeof item === 'object' && item
            ? {
                label: clean((item as Record<string, unknown>).label) || clean((item as Record<string, unknown>).title) || 'Evidence',
                detail: truncate(clean((item as Record<string, unknown>).detail) || clean((item as Record<string, unknown>).summary), 500),
                source: clean((item as Record<string, unknown>).source) || clean((item as Record<string, unknown>).sourceName),
                capturedAt: clean((item as Record<string, unknown>).capturedAt) || clean((item as Record<string, unknown>).at),
            }
            : { label: 'Evidence', detail: truncate(clean(item), 500), source: '', capturedAt: '' })
}

function summarizeEvidence(evidence: ReturnType<typeof normalizeEvidence>) {
    return truncate(evidence
        .slice(0, 3)
        .map((item, index) => {
            const prefix = item.label || `Evidence ${index + 1}`
            const detail = item.detail || item.source || item.capturedAt
            return detail ? `${prefix}: ${detail}` : prefix
        })
        .filter(Boolean)
        .join('\n'), 900)
}

function provenanceSummary(value: unknown) {
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    const captureIds = Array.isArray(record.captureIds) ? record.captureIds.map(clean).filter(Boolean).slice(0, 3) : []
    const sourceIds = Array.isArray(record.sourceIds) ? record.sourceIds.map(clean).filter(Boolean).slice(0, 3) : []
    const parts = [
        captureIds.length ? `captures: ${captureIds.join(', ')}` : '',
        sourceIds.length ? `sources: ${sourceIds.join(', ')}` : '',
        clean(record.primaryCaptureId) ? `primary: ${clean(record.primaryCaptureId)}` : '',
    ].filter(Boolean)
    return truncate(parts.join(' | '), 500)
}

function buildTestAlert(destination: DwmWebhookDestinationRow) {
    return {
        id: 'webhook_test',
        orgName: destination.org_id,
        title: 'Hanasand DWM webhook test',
        severity: 'medium',
        claimSummary: 'This dry-run verifies the destination, Discord formatting, and delivery ledger without exposing the webhook secret.',
        recommendedAction: 'No action required. Confirm this preview has the context your team expects.',
        matchedTerm: { value: 'example.com', kind: 'domain' },
        domain: 'example.com',
        sourceFamily: 'dark_web',
        artifactType: 'test_notification',
        route: 'test_delivery',
        casePath: '/dashboard/dwm',
        watchlist: {
            id: 'test-watchlist',
            name: 'Webhook test watchlist',
            terms: ['example.com'],
        },
    }
}

function isDiscordWebhookUrl(url: URL) {
    return /(^|\.)discord(?:app)?\.com$/i.test(url.hostname) && url.pathname.startsWith('/api/webhooks/')
}

function parseSeverity(value: unknown) {
    const severity = clean(value).toLowerCase()
    return ['critical', 'high', 'medium', 'low', 'info'].includes(severity) ? severity : 'medium'
}

function severityColor(severity: string) {
    if (severity === 'critical') return 0xDC2626
    if (severity === 'high') return 0xEA580C
    if (severity === 'medium') return 0xD97706
    if (severity === 'low') return 0x2563EB
    return 0x475467
}

function severityEmoji(severity: string) {
    if (severity === 'critical') return '[CRITICAL]'
    if (severity === 'high') return '[HIGH]'
    if (severity === 'medium') return '[MEDIUM]'
    if (severity === 'low') return '[LOW]'
    return '[INFO]'
}

function buildIdempotencyKey(eventType: DwmAlertEventType, orgId: string, destinationId: string, alertId: string) {
    return `${eventType}:${orgId}:${destinationId}:${alertId}`
}

function deliveryAttemptState(status: DwmWebhookDeliveryPublic['status'], dryRun: boolean): DwmWebhookDeliveryAttemptState {
    if (dryRun) return 'queued'
    if (status === 'delivered') return 'sent'
    if (status === 'failed') return 'failed'
    return 'skipped'
}

function classifyDeliveryError({
    status,
    dryRun,
    responseStatus,
    error,
}: {
    status: DwmWebhookDeliveryPublic['status']
    dryRun: boolean
    responseStatus?: number | null
    error?: string | null
}) {
    const message = clean(error).toLowerCase()
    if (dryRun || status === 'delivered') return null
    if (message.includes('live dwm webhook delivery is disabled')) return 'live_delivery_disabled'
    if (responseStatus) {
        if (responseStatus === 408) return 'timeout'
        if (responseStatus === 429) return 'rate_limited'
        if (responseStatus >= 500) return 'upstream_5xx'
        if (responseStatus >= 400) return 'upstream_4xx'
    }
    if (message.includes('timeout') || message.includes('abort')) return 'timeout'
    if (message.includes('network') || message.includes('fetch') || message.includes('econn')) return 'network_error'
    if (status === 'skipped') return 'skipped'
    return status === 'failed' ? 'unknown_failure' : null
}

function retryDelayMs(attemptCount: number) {
    const delays = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000]
    return delays[Math.min(Math.max(1, attemptCount), delays.length) - 1]
}

function destinationReadinessBlockers({
    destination,
    latestAttempt,
    liveDeliveryEnabled,
}: {
    destination: ReturnType<typeof buildDwmWebhookDestinationContracts>[number]
    latestAttempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number] | null
    liveDeliveryEnabled: boolean
}) {
    const blockers = []
    if (!destination.enabled) blockers.push('destination_disabled')
    if (!destination.lastTest.requestId) blockers.push('test_delivery_missing')
    if (destination.lastTest.status === 'failed') blockers.push('test_delivery_failed')
    if (!liveDeliveryEnabled) blockers.push('live_delivery_disabled')
    if (latestAttempt?.retryable) blockers.push('retry_scheduled')
    if (latestAttempt?.status === 'failed' && !latestAttempt.retryable) blockers.push('last_delivery_failed')
    if (latestAttempt?.status === 'skipped' && latestAttempt.errorClass !== 'live_delivery_disabled') blockers.push('last_delivery_skipped')
    return [...new Set(blockers)]
}

function idempotencyCoverage(attempts: Array<{ idempotencyKey?: string | null }>) {
    const keys = attempts.map(attempt => clean(attempt.idempotencyKey)).filter(Boolean)
    const groups = new Map<string, number>()
    for (const key of keys) groups.set(key, (groups.get(key) || 0) + 1)
    return {
        attemptCount: attempts.length,
        coveredAttemptCount: keys.length,
        covered: attempts.length === 0 || keys.length === attempts.length,
        duplicateKeyCount: [...groups.values()].filter(count => count > 1).length,
    }
}

function firstClean(...values: unknown[]) {
    for (const value of values) {
        const candidate = clean(value)
        if (candidate) return candidate
    }
    return ''
}

function cleanList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map(clean).filter(Boolean)
}

function hashValue(scope: string, value: string) {
    return `${scope}_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)}`
}

function encryptWebhookSecret(value: string) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

function decryptWebhookSecret(value: string) {
    const [ivB64, tagB64, dataB64] = value.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return value
    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
    return decrypted.toString('utf8')
}

function truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

function redactAuditMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (/endpoint|secret|token|password|credential|url/i.test(key) && key !== 'endpointHint') {
            redacted[key] = '[redacted]'
        } else if (typeof value === 'string') {
            redacted[key] = value.slice(0, 1000)
        } else {
            redacted[key] = value
        }
    }
    return redacted
}

function extractHanasandPayloadContext(payload: unknown) {
    const record = recordOrEmpty(payload)
    return recordOrEmpty(record._hanasand)
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function dedupeFromIdempotencyKey(value: string) {
    const parts = value.split(':')
    return parts.length >= 4 ? parts.slice(3).join(':') : value
}

function redactDeliveryEvidenceText(value: string) {
    return value
        .replace(/(discord(?:app)?\.com\/api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1...')
        .replace(/(api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1...')
        .replace(/([?&](?:token|secret|password|key|credential)=)[^&\s"']+/gi, '$1[redacted]')
        .replace(/((?:token|secret|password|credential)\s*[:=]\s*)[^,\s"'}]+/gi, '$1[redacted]')
}

function redactNullableDeliveryText(value: string | null) {
    return value ? redactDeliveryEvidenceText(value) : null
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
