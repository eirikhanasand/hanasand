import crypto from 'node:crypto'
import run from '#db'
import { organizationVisibilityDecision, type OrganizationRole, type OrganizationVisibilityDecisionInput } from '#utils/organizations.ts'

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
    label?: unknown
    kind?: unknown
    type?: unknown
    endpointUrl?: unknown
    endpoint_url?: unknown
    webhookUrl?: unknown
    webhook_url?: unknown
    url?: unknown
    channel?: unknown
    channelName?: unknown
    channel_name?: unknown
    status?: unknown
    events?: unknown
    requestId?: unknown
    request_id?: unknown
    entitlementAllowed?: unknown
    entitlement_allowed?: unknown
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
    requestId?: unknown
    deliveryId?: unknown
}

export type DwmWebhookDeliveryAttemptState = 'queued' | 'sent' | 'failed' | 'skipped'
export type DwmWebhookDeliveryOperationBlockerCode =
    | 'missing_org'
    | 'missing_alert_context'
    | 'destination_disabled'
    | 'destination_unhealthy'
    | 'missing_webhook_url'
    | 'dedupe_already_delivered'
    | 'retry_not_eligible'
    | 'live_delivery_disabled'
    | 'not_found'
export type DwmWebhookDestinationAdminProofBlockerCode =
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'no_live_endpoint'
    | 'destination_unhealthy'
    | 'missing_org_alert_context'
    | 'permission_denied'
    | 'dedupe_already_delivered'
    | 'audit_missing'
    | 'retry_not_eligible'
export type DwmWebhookDestinationCrudAction = 'create' | 'update' | 'disable' | 'enable' | 'test'
export type DwmWebhookDestinationCrudBlockerCode =
    | 'invalid_url'
    | 'unsupported_destination_type'
    | 'duplicate_destination'
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'unhealthy_destination'
    | 'entitlement_plan_denied'
    | 'permission_denied'
    | 'audit_missing'
    | 'idempotency_duplicate'
    | 'retry_not_eligible'

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
    const rawEndpoint = firstClean(input.endpointUrl, input.endpoint_url, input.webhookUrl, input.webhook_url, input.url)
    const endpointUrl = rawEndpoint ? normalizeWebhookUrl(rawEndpoint) : null
    const kind = parseKind(input.kind ?? input.type, endpointUrl, existing?.kind)
    const channelName = firstClean(input.channelName, input.channel_name, input.channel)
    const name = firstClean(input.name, input.label, channelName) || existing?.name || (kind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
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
        requestId: clean(filters.requestId) || clean(filters.deliveryId),
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
            if (normalizedFilters.requestId && evidence.requestId !== normalizedFilters.requestId && evidence.deliveryId !== normalizedFilters.requestId) return false
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

export function buildDwmWebhookDeliveryOperations({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
}) {
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents, filters })
    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const auditByDelivery = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const sortedLedger = [...ledger]
        .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
    const recentDeliveries = sortedLedger.map((attempt) => {
        const destination = attempt.destinationId ? destinationsById.get(attempt.destinationId) || null : null
        const audit = auditByDelivery.get(attempt.deliveryId) || null
        return {
            schemaVersion: 'dwm.webhook.delivery_operation.v1',
            requestId: attempt.requestId,
            deliveryId: attempt.deliveryId,
            orgId: attempt.orgId,
            destinationId: attempt.destinationId,
            alertId: attempt.alertId,
            eventType: attempt.eventType,
            status: attempt.status,
            rawStatus: attempt.rawStatus,
            dryRun: attempt.dryRun,
            live: attempt.live,
            liveRequested: attempt.liveRequested,
            replay: attempt.replay,
            idempotencyKey: attempt.idempotencyKey,
            dedupeKey: attempt.dedupeKey,
            watchlistId: attempt.watchlistId,
            watchlistName: attempt.watchlistName,
            route: attempt.route,
            casePath: attempt.casePath,
            destination: {
                id: attempt.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                status: destination?.status || null,
                enabled: destination ? destination.status === 'active' : null,
                redactedEndpoint: attempt.redactedDestination,
            },
            attempts: {
                count: attempt.attemptCount,
                retryable: attempt.retryable,
                nextRetryAt: attempt.nextRetryAt,
                lastErrorCategory: attempt.errorClass,
                reason: attempt.retryReason,
            },
            response: {
                httpStatus: attempt.responseStatus,
                summary: attempt.responseSummary,
            },
            error: attempt.error,
            payloadHash: attempt.payloadHash,
            auditEventId: audit?.auditEventId || attempt.auditEventId,
            auditAction: audit?.action || attempt.auditAction,
            attemptedAt: attempt.attemptedAt,
            createdAt: attempt.createdAt,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_operations.v1',
        liveDeliveryEnabled,
        filters: {
            orgId: clean(filters.orgId) || null,
            destinationId: clean(filters.destinationId) || null,
            alertId: clean(filters.alertId) || null,
            casePath: clean(filters.casePath) || null,
            dedupeKey: clean(filters.dedupeKey) || null,
            requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
        },
        total: recentDeliveries.length,
        counts: {
            queued: recentDeliveries.filter(item => item.status === 'queued').length,
            sent: recentDeliveries.filter(item => item.status === 'sent').length,
            failed: recentDeliveries.filter(item => item.status === 'failed').length,
            skipped: recentDeliveries.filter(item => item.status === 'skipped').length,
            dryRun: recentDeliveries.filter(item => item.dryRun).length,
            live: recentDeliveries.filter(item => item.live).length,
            replay: recentDeliveries.filter(item => item.replay).length,
            retryable: recentDeliveries.filter(item => item.attempts.retryable).length,
        },
        recentDeliveries,
    }
}

export function buildDwmWebhookDeliveryHistory({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
}) {
    const operations = buildDwmWebhookDeliveryOperations({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const auditByDelivery = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const retryByIdempotencyKey = new Map(retryPersistence.deliveryKeys.map(key => [key.idempotencyKey, key]))
    const entries = operations.recentDeliveries.map((operation) => {
        const delivery = deliveryById.get(operation.deliveryId) || null
        const preview = delivery ? buildDwmWebhookDeliveryPreview(delivery) : null
        const discordEmbeds = Array.isArray(preview?.discord.embeds)
            ? preview.discord.embeds as Array<Record<string, unknown>>
            : []
        const firstDiscordEmbed = discordEmbeds[0]
        const retryKey = operation.idempotencyKey ? retryByIdempotencyKey.get(operation.idempotencyKey) || null : null
        const audit = auditByDelivery.get(operation.deliveryId) || null
        const alert = preview?.context.alert || null
        const watchlist = preview?.context.watchlist || null

        return {
            schemaVersion: 'dwm.webhook.delivery_history_entry.v1',
            requestId: operation.requestId,
            deliveryId: operation.deliveryId,
            orgId: operation.orgId,
            destinationId: operation.destinationId,
            eventType: operation.eventType,
            status: operation.status,
            rawStatus: operation.rawStatus,
            dryRun: operation.dryRun,
            live: operation.live,
            liveRequested: operation.liveRequested,
            replay: operation.replay,
            alert: {
                id: operation.alertId,
                title: clean(alert?.title),
                severity: clean(alert?.severity),
                sourceFamily: clean(alert?.sourceFamily),
                evidenceCount: parseCount(alert?.evidenceCount),
                dedupeKey: operation.dedupeKey || clean(alert?.dedupeKey),
                casePath: operation.casePath || clean(alert?.casePath),
                alertUrl: clean(alert?.alertUrl),
                caseId: clean(alert?.caseId),
            },
            watchlist: {
                id: operation.watchlistId || clean(watchlist?.id),
                name: operation.watchlistName || clean(watchlist?.name),
                terms: cleanList(watchlist?.terms),
            },
            destination: operation.destination,
            deliveryProof: {
                idempotencyKey: operation.idempotencyKey,
                payloadHash: operation.payloadHash,
                auditEventId: audit?.auditEventId || operation.auditEventId,
                auditAction: audit?.action || operation.auditAction,
                attemptedAt: operation.attemptedAt,
                createdAt: operation.createdAt,
                response: operation.response,
                error: operation.error,
            },
            retry: {
                retryable: operation.attempts.retryable,
                nextRetryAt: operation.attempts.nextRetryAt,
                attemptCount: operation.attempts.count,
                lastErrorCategory: operation.attempts.lastErrorCategory,
                terminalFailure: retryKey?.retry.terminalFailure || false,
            },
            dedupe: {
                alreadyDelivered: retryKey?.dedupe.alreadyDelivered || false,
                duplicateAttemptCount: retryKey?.dedupe.duplicateAttemptCount || 0,
            },
            discordPreview: preview
                ? {
                    content: preview.discord.content,
                    embedCount: discordEmbeds.length,
                    title: clean(firstDiscordEmbed?.title),
                    fieldNames: Array.isArray(firstDiscordEmbed?.fields)
                        ? (firstDiscordEmbed.fields as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                        : [],
                    allowedMentions: preview.discord.allowedMentions,
                }
                : null,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_history.v1',
        liveDeliveryEnabled,
        filters: operations.filters,
        total: entries.length,
        counts: operations.counts,
        entries,
    }
}

export function buildDwmWebhookDeliveryRetryPersistence({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    now = new Date(),
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    now?: Date
}) {
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents, filters, now })
    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const auditsByDelivery = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.deliveryId) continue
        const audits = auditsByDelivery.get(audit.deliveryId) || []
        audits.push(audit)
        auditsByDelivery.set(audit.deliveryId, audits)
    }
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const groups = new Map<string, typeof ledger>()
    for (const attempt of ledger) {
        const key = attempt.idempotencyKey || attempt.deliveryId
        const attempts = groups.get(key) || []
        attempts.push(attempt)
        groups.set(key, attempts)
    }

    const deliveryKeys = [...groups.entries()].map(([key, attempts]) => {
        const sortedAttempts = [...attempts]
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latest = sortedAttempts[0]
        const sent = sortedAttempts.find(attempt => attempt.status === 'sent') || null
        const destination = latest.destinationId ? destinationsById.get(latest.destinationId) || null : null
        const auditEventIds = [...new Set(sortedAttempts.flatMap((attempt) => {
            const audits = auditsByDelivery.get(attempt.deliveryId) || []
            return [
                attempt.auditEventId,
                ...audits.map(audit => audit.auditEventId),
            ].filter(Boolean) as string[]
        }))]
        const terminalFailure = !sent
            && (latest.status === 'failed' || latest.status === 'skipped')
            && !latest.retryable
            && latest.errorClass !== 'live_delivery_disabled'
        const retryable = !sent && latest.retryable
        const duplicateAttemptCount = sortedAttempts.length > 1 ? sortedAttempts.length : 0

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_key.v1',
            idempotencyKey: latest.idempotencyKey || key,
            dedupeKey: latest.dedupeKey || dedupeFromIdempotencyKey(latest.idempotencyKey) || null,
            orgId: latest.orgId,
            destinationId: latest.destinationId,
            alertId: latest.alertId,
            eventType: latest.eventType,
            watchlistId: latest.watchlistId,
            watchlistName: latest.watchlistName,
            route: latest.route,
            casePath: latest.casePath,
            replay: sortedAttempts.some(attempt => attempt.replay),
            status: sent ? 'delivered' : retryable ? 'retry_scheduled' : terminalFailure ? 'terminal_failure' : latest.status,
            destination: {
                id: latest.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                status: destination?.status || null,
                enabled: destination ? destination.status === 'active' : null,
                redactedEndpoint: latest.redactedDestination,
            },
            retry: {
                persistedAttemptCount: sortedAttempts.length,
                attemptCount: latest.attemptCount,
                retryable,
                nextRetryAt: retryable ? latest.nextRetryAt : null,
                lastErrorCategory: latest.errorClass,
                reason: latest.retryReason,
                terminalFailure,
            },
            dedupe: {
                alreadyDelivered: Boolean(sent),
                duplicate: duplicateAttemptCount > 0,
                duplicateAttemptCount,
                latestDedupeKey: latest.dedupeKey || dedupeFromIdempotencyKey(latest.idempotencyKey) || null,
            },
            latestAttempt: {
                requestId: latest.requestId,
                deliveryId: latest.deliveryId,
                status: latest.status,
                rawStatus: latest.rawStatus,
                dryRun: latest.dryRun,
                live: latest.live,
                liveRequested: latest.liveRequested,
                responseStatus: latest.responseStatus,
                errorClass: latest.errorClass,
                attemptedAt: latest.attemptedAt,
                auditEventId: latest.auditEventId,
            },
            attempts: sortedAttempts.slice(0, 5).map(attempt => ({
                requestId: attempt.requestId,
                deliveryId: attempt.deliveryId,
                status: attempt.status,
                rawStatus: attempt.rawStatus,
                dryRun: attempt.dryRun,
                live: attempt.live,
                liveRequested: attempt.liveRequested,
                retryable: attempt.retryable,
                nextRetryAt: attempt.nextRetryAt,
                errorClass: attempt.errorClass,
                responseStatus: attempt.responseStatus,
                auditEventId: attempt.auditEventId,
                attemptedAt: attempt.attemptedAt,
            })),
            audit: {
                latestAuditEventId: auditEventIds[0] || null,
                auditEventIds,
            },
        }
    }).sort((a, b) => String(b.latestAttempt.attemptedAt).localeCompare(String(a.latestAttempt.attemptedAt)))

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_persistence.v1',
        liveDeliveryEnabled,
        filters: {
            orgId: clean(filters.orgId) || null,
            destinationId: clean(filters.destinationId) || null,
            alertId: clean(filters.alertId) || null,
            casePath: clean(filters.casePath) || null,
            dedupeKey: clean(filters.dedupeKey) || null,
            requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
        },
        totalDeliveryKeys: deliveryKeys.length,
        counts: {
            attempts: ledger.length,
            retryable: deliveryKeys.filter(item => item.retry.retryable).length,
            terminalFailure: deliveryKeys.filter(item => item.retry.terminalFailure).length,
            delivered: deliveryKeys.filter(item => item.dedupe.alreadyDelivered).length,
            dryRun: deliveryKeys.filter(item => item.latestAttempt.dryRun).length,
            live: deliveryKeys.filter(item => item.latestAttempt.live).length,
            replay: deliveryKeys.filter(item => item.replay).length,
            duplicateDedupe: deliveryKeys.filter(item => item.dedupe.duplicate).length,
        },
        idempotencyCoverage: idempotencyCoverage(ledger),
        deliveryKeys,
    }
}

export function buildDwmWebhookDeliveryRetryQueue({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const decision = visibility
        ? organizationVisibilityDecision(visibility)
        : {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members' as const,
            allowedRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
        }
    const access = {
        role: clean(viewerRole) || null,
        canRead: decision.allowed,
        canManage: decision.allowed && canManage,
        canRetry: decision.allowed && canManage,
        memberSafe: decision.allowed && !canManage,
    }
    const deniedBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery retry queue is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: {
                orgId: clean(filters.orgId) || null,
                destinationId: clean(filters.destinationId) || null,
                alertId: clean(filters.alertId) || null,
                casePath: clean(filters.casePath) || null,
                dedupeKey: clean(filters.dedupeKey) || null,
                requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
            },
            counts: {
                total: 0,
                retryable: 0,
                dryRunReady: 0,
                liveReady: 0,
                blocked: 0,
                delivered: 0,
                terminalFailure: 0,
                auditLinked: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
    })
    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const entries = persistence.deliveryKeys.map((key) => {
        const destinationId = key.destinationId || null
        const destination = destinationId ? destinationsById.get(destinationId) || null : null
        const health = destinationId ? healthByDestination.get(destinationId) || null : null
        const blockers = []
        if (!access.canRetry) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can retry webhook deliveries.', key.destinationId, true))
        if (destination && destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', key.destinationId, true))
        if (!key.destination.redactedEndpoint.endpointHash && !key.destination.redactedEndpoint.endpointHint) blockers.push(retryQueueBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', key.destinationId, true))
        if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; dry-run retry proof is still available.', key.destinationId, false))
        if (key.dedupe.alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', key.destinationId, true))
        if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', key.destinationId, true))
        if (!key.retry.retryable && !key.dedupe.alreadyDelivered && !key.retry.terminalFailure) blockers.push(retryQueueBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', key.destinationId, true))
        if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Retry queue entry has no linked audit event yet.', key.destinationId, false))
        const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const dryRunReady = access.canRetry && key.retry.retryable && blockingCodes.length === 0
        const liveReady = dryRunReady && liveDeliveryEnabled

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue_entry.v1',
            idempotencyKey: key.idempotencyKey,
            orgId: key.orgId,
            destinationId: key.destinationId,
            alertId: key.alertId,
            eventType: key.eventType,
            watchlistId: key.watchlistId,
            watchlistName: key.watchlistName,
            route: key.route,
            casePath: key.casePath,
            replay: key.replay,
            status: key.status,
            destination: key.destination,
            health: {
                status: health?.health || null,
                ready: health?.ready || false,
                blockers: health?.blockers || [],
                latestAuditEventId: health?.latestAuditEventId || null,
            },
            retry: {
                ...key.retry,
                dryRunReady,
                liveReady,
                mode: liveReady ? 'live' : dryRunReady ? 'dry_run' : 'blocked',
            },
            dedupe: key.dedupe,
            latestAttempt: key.latestAttempt,
            attempts: key.attempts,
            audit: key.audit,
            blockers: uniqueRetryQueueBlockers(blockers),
            blockingCodes,
            noNetwork: true,
            externalSendEnabled: liveReady,
        }
    })
    const blockers = uniqueRetryQueueBlockers(entries.flatMap(entry => entry.blockers))

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            dryRunReady: entries.filter(entry => entry.retry.dryRunReady).length,
            liveReady: entries.filter(entry => entry.retry.liveReady).length,
            blocked: entries.filter(entry => entry.blockingCodes.length > 0).length,
            delivered: entries.filter(entry => entry.dedupe.alreadyDelivered).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
            auditLinked: entries.filter(entry => Boolean(entry.audit.latestAuditEventId)).length,
        },
        blockers,
        entries,
    }
}

export function buildDwmWebhookDestinationDeliveryMatrix({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const decision = visibility
        ? organizationVisibilityDecision(visibility)
        : {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members' as const,
            allowedRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
        }
    const access = {
        role: clean(viewerRole) || null,
        canRead: decision.allowed,
        canManage: decision.allowed && canManage,
        canTest: decision.allowed && canManage,
        canRetry: decision.allowed && canManage,
        memberSafe: decision.allowed && !canManage,
    }
    if (!decision.allowed) {
        const blocker = destinationMatrixBlocker('permission_denied', 'Webhook destination delivery matrix is not visible for this organization membership.', null, true)
        return {
            schemaVersion: 'dwm.webhook.destination_delivery_matrix.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                deliveryConfiguredCount: 0,
                retryReadyCount: 0,
                blockedCount: 0,
                latestDeliveryAt: null,
            },
            blockers: [blocker],
            destinations: [],
            routes: {
                destinationList: 'GET /api/dwm/webhooks?orgId=<org_id>',
                deliveryList: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
                testDestination: 'POST /api/dwm/webhook-destinations/:id/test',
                triggerDelivery: 'POST /api/dwm/webhook-deliveries',
            },
        }
    }

    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const operations = buildDwmWebhookDeliveryOperations({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))
    const retryEntriesByDestination = new Map<string, typeof retryQueue.entries>()
    for (const entry of retryQueue.entries) {
        if (!entry.destinationId) continue
        const rows = retryEntriesByDestination.get(entry.destinationId) || []
        rows.push(entry)
        retryEntriesByDestination.set(entry.destinationId, rows)
    }
    const operationsByDestination = new Map<string, typeof operations.recentDeliveries>()
    for (const operation of operations.recentDeliveries) {
        if (!operation.destinationId) continue
        const rows = operationsByDestination.get(operation.destinationId) || []
        rows.push(operation)
        operationsByDestination.set(operation.destinationId, rows)
    }
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const rows = auditByDestination.get(audit.destinationId) || []
        rows.push(audit)
        auditByDestination.set(audit.destinationId, rows)
    }

    const rows = destinations.map((destination) => {
        const health = healthByDestination.get(destination.id) || null
        const destinationOperations = (operationsByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const retryEntries = (retryEntriesByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.latestAttempt.attemptedAt).localeCompare(String(a.latestAttempt.attemptedAt)))
        const audits = (auditByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const lastTest = destinationOperations.find(operation => operation.eventType === 'dwm.alert.test') || null
        const lastCreated = destinationOperations.find(operation => operation.eventType === 'dwm.alert.created') || null
        const lastReplayed = destinationOperations.find(operation => operation.eventType === 'dwm.alert.replayed') || null
        const lastOrgAlert = destinationOperations.find(operation => operation.eventType !== 'dwm.alert.test') || null
        const retryReady = retryEntries.find(entry => entry.retry.dryRunReady) || null
        const terminalFailure = retryEntries.find(entry => entry.retry.terminalFailure) || null
        const blockers = []
        if (destination.status !== 'active') blockers.push(destinationMatrixBlocker('destination_disabled', 'Destination is disabled.', destination.id, true))
        if (!destination.endpointHash && !destination.endpointHint) blockers.push(destinationMatrixBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', destination.id, true))
        if (!lastTest) blockers.push(destinationMatrixBlocker('no_verified_dry_run', 'Destination has no dry-run/test delivery proof.', destination.id, false))
        if (!lastOrgAlert) blockers.push(destinationMatrixBlocker('missing_org_alert_context', 'Destination has no org alert delivery proof yet.', destination.id, false))
        if (retryReady) blockers.push(destinationMatrixBlocker('retry_scheduled', 'Destination has a retryable failed delivery.', destination.id, false))
        if (terminalFailure) blockers.push(destinationMatrixBlocker('terminal_failure', 'Destination has a terminal failed delivery.', destination.id, true))
        if (!liveDeliveryEnabled) blockers.push(destinationMatrixBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', destination.id, false))

        return {
            schemaVersion: 'dwm.webhook.destination_delivery_matrix_row.v1',
            orgId: destination.orgId,
            destinationId: destination.id,
            type: destination.kind,
            label: destination.name,
            status: destination.status,
            enabled: destination.status === 'active',
            redactedEndpoint: {
                endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                endpointHash: destination.endpointHash,
            },
            subscribedEvents: destination.events,
            eventCoverage: {
                created: destination.events.includes('dwm.alert.created'),
                replayed: destination.events.includes('dwm.alert.replayed'),
                test: true,
            },
            deliveryProof: {
                lastTest,
                lastCreated,
                lastReplayed,
                lastOrgAlert,
                latestDeliveryAt: lastOrgAlert?.attemptedAt || lastTest?.attemptedAt || null,
            },
            health: {
                status: health?.health || (destination.status === 'active' ? 'blocked' : 'disabled'),
                ready: health?.ready || false,
                states: health ? destinationHealthStates(health) : [],
                blockers: health?.blockers || [],
                latestAuditEventId: health?.latestAuditEventId || audits[0]?.auditEventId || null,
            },
            retry: {
                ready: Boolean(retryReady),
                dryRunReady: Boolean(retryReady?.retry.dryRunReady),
                liveReady: Boolean(retryReady?.retry.liveReady),
                nextRetryAt: retryReady?.retry.nextRetryAt || null,
                lastErrorCategory: retryReady?.retry.lastErrorCategory || terminalFailure?.retry.lastErrorCategory || null,
                requestId: retryReady?.latestAttempt.requestId || terminalFailure?.latestAttempt.requestId || null,
                idempotencyKey: retryReady?.idempotencyKey || terminalFailure?.idempotencyKey || null,
            },
            replay: {
                latestRequestId: lastReplayed?.requestId || null,
                latestDedupeKey: lastReplayed?.dedupeKey || null,
                count: destinationOperations.filter(operation => operation.replay).length,
            },
            audit: {
                latestAuditEventId: health?.latestAuditEventId || audits[0]?.auditEventId || null,
                auditEventIds: [...new Set([
                    health?.latestAuditEventId,
                    ...audits.map(audit => audit.auditEventId),
                ].filter(Boolean) as string[])],
                auditEventContracts: access.canManage ? audits.slice(0, 10) : [],
            },
            blockers: uniqueDestinationMatrixBlockers(blockers),
            routes: {
                detail: `GET /api/dwm/webhook-deliveries?orgId=${encodeURIComponent(destination.orgId)}&destinationId=${encodeURIComponent(destination.id)}`,
                test: `POST /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}/test`,
                trigger: 'POST /api/dwm/webhook-deliveries',
            },
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })
    const blockers = uniqueDestinationMatrixBlockers(rows.flatMap(row => row.blockers))
    const latestDeliveryAt = rows
        .map(row => row.deliveryProof.latestDeliveryAt)
        .filter(Boolean)
        .sort((a, b) => String(b).localeCompare(String(a)))[0] || null

    return {
        schemaVersion: 'dwm.webhook.destination_delivery_matrix.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        visibility: decision,
        access,
        summary: {
            destinationCount: rows.length,
            activeDestinationCount: rows.filter(row => row.enabled).length,
            deliveryConfiguredCount: rows.filter(row => row.deliveryProof.lastOrgAlert || row.deliveryProof.lastTest).length,
            retryReadyCount: rows.filter(row => row.retry.ready).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
            latestDeliveryAt,
        },
        blockers,
        destinations: rows,
        routes: {
            destinationList: 'GET /api/dwm/webhooks?orgId=<org_id>',
            deliveryList: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
            testDestination: 'POST /api/dwm/webhook-destinations/:id/test',
            triggerDelivery: 'POST /api/dwm/webhook-deliveries',
        },
    }
}

export function buildDwmWebhookDeliveryRetryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const orgId = firstClean(normalizedInput.orgId, normalizedInput.organizationId, normalizedInput.tenantId)
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.replayed')
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const alertContext = recordOrEmpty(normalizedInput.alert)
    const alertId = firstClean(normalizedInput.alertId, alertContext.id, alertContext.alertId)
    const dedupeKey = firstClean(normalizedInput.dedupeKey, alertContext.dedupeKey, alertId)
    const dispatchDestinations = destinations.map(destination => ({
        id: destination.id,
        org_id: destination.orgId,
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: destination.events,
    }))
    const dispatch = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input: normalizedInput,
        destinations: dispatchDestinations,
    })
    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(destinationHealth.map(health => [health.destinationId, health]))
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const selectedIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const candidateDestinationIds = destinationId ? [destinationId] : [
        ...dispatch.selectedDestinations.map(destination => destination.id),
        ...dispatch.skippedDestinations.map(destination => destination.id),
    ]
    const blockers: Array<{
        code: DwmWebhookDeliveryOperationBlockerCode
        message: string
        destinationId: string | null
        retryable: boolean
    }> = []

    if (!orgId) blockers.push(operationBlocker('missing_org', 'Organization context is required before retrying webhook delivery.'))
    if (!alertId && !dedupeKey) blockers.push(operationBlocker('missing_alert_context', 'Alert id or dedupe key is required before retrying webhook delivery.'))
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(operationBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    if (destinationId && !destinations.some(destination => destination.id === destinationId)) {
        blockers.push(operationBlocker('not_found', 'Destination is not available for this organization.', destinationId))
    }

    for (const candidateId of candidateDestinationIds) {
        const destination = destinations.find(item => item.id === candidateId)
        const health = candidateId ? healthByDestination.get(candidateId) || null : null
        if (!destination) continue
        if (destination.status !== 'active') {
            blockers.push(operationBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', destination.id))
        }
        if (!destination.endpointHint || !destination.endpointHash) {
            blockers.push(operationBlocker('missing_webhook_url', 'Destination does not have a configured webhook URL.', destination.id))
        }
        if (health && !health.ready && !health.blockers.every(blocker => blocker === 'live_delivery_disabled' || blocker === 'retry_scheduled')) {
            blockers.push(operationBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }
    }

    const targetIds = selectedIds.size > 0 ? selectedIds : new Set(candidateDestinationIds.filter(Boolean))
    for (const targetId of targetIds) {
        const idempotencyKey = orgId && targetId && dedupeKey
            ? buildIdempotencyKey(eventType, orgId, targetId, dedupeKey)
            : ''
        if (!idempotencyKey) continue
        const related = ledger.filter(attempt => attempt.idempotencyKey === idempotencyKey)
        const sent = related.find(attempt => attempt.status === 'sent')
        const latest = [...related].sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))[0]
        if (sent) {
            blockers.push(operationBlocker('dedupe_already_delivered', 'This alert/destination idempotency key has already been delivered.', targetId))
        } else if (latest && !latest.retryable && latest.status !== 'queued') {
            blockers.push(operationBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', targetId))
        }
    }

    const uniqueBlockers = uniqueOperationBlockers(blockers)
    return {
        schemaVersion: 'dwm.webhook.delivery_retry.v1',
        ownerId,
        orgId: orgId || null,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        canRetry: canManage && uniqueBlockers.length === 0,
        canTest: canManage && uniqueBlockers.every(blocker => blocker.code !== 'missing_org' && blocker.code !== 'not_found'),
        access: {
            canManage,
            canRetry: canManage,
            canTest: canManage,
        },
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: destinationId || undefined,
                alertId: alertId || undefined,
                dedupeKey: dedupeKey || undefined,
            },
            liveDeliveryEnabled,
        }),
    }
}

export function buildDwmWebhookAuditEventContracts({
    auditEvents,
    deliveries = [],
    destinations = [],
}: {
    auditEvents: DwmWebhookAuditPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    destinations?: DwmWebhookDestinationPublic[]
}) {
    const ledgerByDelivery = new Map(buildDwmWebhookDeliveryLedger({ deliveries, auditEvents }).map(item => [item.deliveryId, item]))
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))

    return [...auditEvents]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((audit) => {
            const delivery = audit.deliveryId ? deliveryById.get(audit.deliveryId) || null : null
            const ledger = audit.deliveryId ? ledgerByDelivery.get(audit.deliveryId) || null : null
            const destination = audit.destinationId ? destinationById.get(audit.destinationId) || null : null
            const metadata = redactAuditContractMetadata(recordOrEmpty(audit.metadata))
            const endpointHint = clean(destination?.endpointHint)
                || clean(delivery?.endpointHint)
                || clean(metadata.endpointHint)
            const endpointHash = clean(destination?.endpointHash)
                || clean(delivery?.endpointHash)
                || clean(metadata.endpointHash)

            return {
                schemaVersion: 'dwm.webhook.audit_event.v1',
                auditEventId: audit.id,
                eventId: audit.id,
                action: audit.action,
                category: webhookAuditCategory(audit.action),
                outcome: webhookAuditOutcome(audit.action, delivery?.status || clean(metadata.status)),
                severity: webhookAuditSeverity(audit.action, delivery?.status || clean(metadata.status)),
                actorId: audit.actorId,
                orgId: audit.orgId,
                destinationId: audit.destinationId,
                deliveryId: audit.deliveryId,
                requestId: audit.deliveryId,
                destination: audit.destinationId
                    ? {
                        id: audit.destinationId,
                        label: destination?.name || null,
                        type: destination?.kind || null,
                        status: destination?.status || null,
                        enabled: destination ? destination.status === 'active' : null,
                        redactedEndpoint: {
                            endpointHint: endpointHint ? redactDeliveryEvidenceText(endpointHint) : null,
                            endpointHash: endpointHash || null,
                        },
                    }
                    : null,
                delivery: delivery
                    ? {
                        alertId: delivery.alertId,
                        eventType: delivery.eventType,
                        status: delivery.status,
                        dryRun: delivery.dryRun,
                        live: !delivery.dryRun && delivery.status !== 'skipped',
                        idempotencyKey: delivery.idempotencyKey,
                        payloadHash: delivery.payloadHash,
                        responseStatus: delivery.responseStatus,
                        error: redactNullableDeliveryText(delivery.error),
                        watchlistId: delivery.watchlistId,
                        watchlistName: delivery.watchlistName,
                        route: delivery.route,
                        casePath: delivery.casePath,
                        attemptedAt: delivery.attemptedAt,
                    }
                    : null,
                retry: ledger
                    ? {
                        retryable: ledger.retryable,
                        nextRetryAt: ledger.nextRetryAt,
                        errorClass: ledger.errorClass,
                        reason: ledger.retryReason,
                        attemptCount: ledger.attemptCount,
                    }
                    : null,
                metadata,
                createdAt: audit.createdAt,
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

export function buildDwmWebhookDestinationHealth({
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
    const readiness = buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const readinessByDestination = new Map(readiness.destinations.map(item => [item.destinationId, item]))
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
    const ledgerByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = ledgerByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        ledgerByDestination.set(attempt.destinationId, attempts)
    }

    return destinationContracts.map((destination) => {
        const attempts = (ledgerByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const audits = (auditByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const readinessRow = readinessByDestination.get(destination.id) || null
        const lastDryRun = attempts.find(attempt => attempt.dryRun) || null
        const lastDelivery = attempts.find(attempt => !attempt.dryRun && attempt.rawStatus !== 'skipped') || null
        const lastFailure = attempts.find(attempt => attempt.rawStatus === 'failed' || attempt.errorClass) || null
        const lastLiveDisabled = attempts.find(attempt => attempt.errorClass === 'live_delivery_disabled') || null
        const latestAttempt = attempts[0] || null
        const lastTestAuditId = auditEventIdForDelivery(audits, destination.lastTest.requestId)
        const lastDeliveryAuditId = auditEventIdForDelivery(audits, destination.lastDelivery.requestId)

        return {
            schemaVersion: 'dwm.webhook.destination_health.v1',
            destinationId: destination.id,
            orgId: destination.orgId,
            owner: {
                ownerId: destination.createdBy,
                createdBy: destination.createdBy,
                actorId: destination.actorId,
            },
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            health: readinessRow?.readiness || (destination.enabled ? 'blocked' : 'disabled'),
            ready: readinessRow?.ready || false,
            liveDeliveryEnabled,
            redactedEndpoint: destination.redactedDestination,
            blockers: readinessRow?.blockers || [],
            retry: readinessRow?.retryState || { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 },
            lastDryRun: lastDryRun ? destinationHealthAttempt(lastDryRun, auditEventIdForDelivery(audits, lastDryRun.deliveryId)) : null,
            lastTest: {
                ...destination.lastTest,
                auditEventId: destination.lastTest.auditEventId || lastTestAuditId,
            },
            lastDelivery: {
                ...destination.lastDelivery,
                auditEventId: destination.lastDelivery.auditEventId || lastDeliveryAuditId,
            },
            lastFailure: lastFailure ? destinationHealthAttempt(lastFailure, auditEventIdForDelivery(audits, lastFailure.deliveryId)) : null,
            lastLiveDisabled: lastLiveDisabled ? destinationHealthAttempt(lastLiveDisabled, auditEventIdForDelivery(audits, lastLiveDisabled.deliveryId)) : null,
            latestAttempt: latestAttempt ? destinationHealthAttempt(latestAttempt, auditEventIdForDelivery(audits, latestAttempt.deliveryId)) : null,
            idempotencyCoverage: readinessRow?.idempotencyCoverage || idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5).map(attempt => destinationHealthAttempt(attempt, auditEventIdForDelivery(audits, attempt.deliveryId))),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
            auditEventContracts: audits.slice(0, 10),
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })
}

export function filterDwmWebhookDestinationHealthForVisibility({
    destinationHealth,
    visibility,
}: {
    destinationHealth: ReturnType<typeof buildDwmWebhookDestinationHealth>
    visibility: DwmWebhookEvidenceVisibilityInput
}) {
    const decision = organizationVisibilityDecision(visibility)
    return {
        decision,
        destinationHealth: decision.allowed ? destinationHealth : [],
    }
}

export function buildDwmWebhookDashboardReadinessAdapter({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    visibility = null,
    orgStatus = 'active',
    watchlistStatus = 'active',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
    orgStatus?: unknown
    watchlistStatus?: unknown
}) {
    const visibilityDecision = visibility ? organizationVisibilityDecision(visibility) : {
        allowed: true,
        reason: null,
        alertVisibilityPolicy: 'members',
        allowedRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
    }
    const orgLifecycleStatus = clean(orgStatus).toLowerCase() || 'active'
    const watchlistLifecycleStatus = clean(watchlistStatus).toLowerCase() || 'active'
    const orgBlocked = ['archived', 'disabled', 'deleted', 'suspended'].includes(orgLifecycleStatus)
    const watchlistBlocked = ['archived', 'retired', 'deleted'].includes(watchlistLifecycleStatus)
    const policyBlockers = [
        visibilityDecision.allowed ? null : dashboardReadinessBlocker('policy_blocked', 'Destination readiness is not visible for this actor.', null, visibilityDecision.reason || 'permission_denied'),
        orgBlocked ? dashboardReadinessBlocker('policy_blocked', 'Organization lifecycle blocks webhook delivery.', null, 'org_archived') : null,
        watchlistBlocked ? dashboardReadinessBlocker('policy_blocked', 'Retired or archived watchlist blocks alert delivery.', null, 'watchlist_retired') : null,
    ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]

    if (!visibilityDecision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
            liveDeliveryEnabled,
            visibility: visibilityDecision,
            orgStatus: orgLifecycleStatus,
            watchlistStatus: watchlistLifecycleStatus,
            summary: {
                destinationCount: 0,
                verifiedCount: 0,
                blockedCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
                disabledCount: 0,
                policyBlockedCount: 1,
            },
            blockers: policyBlockers,
            destinations: [],
        }
    }

    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryKeysByDestination = new Map<string, ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys']>()
    for (const key of retryPersistence.deliveryKeys) {
        if (!key.destinationId) continue
        const keys = retryKeysByDestination.get(key.destinationId) || []
        keys.push(key)
        retryKeysByDestination.set(key.destinationId, keys)
    }
    const rows = destinationHealth.map((health) => {
        const retryKeys = retryKeysByDestination.get(health.destinationId) || []
        const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
        const latestRetryKey = retryKeys[0] || null
        const terminalFailure = Boolean(
            health.lastFailure
            && !health.lastFailure.retryable
            && health.lastFailure.errorClass !== 'live_delivery_disabled'
        ) || retryKeys.some(key => key.retry.terminalFailure)
        const states = [
            policyBlockers.length ? 'policy_blocked' : null,
            !health.enabled ? 'disabled' : null,
            endpointPresent ? null : 'secret_missing',
            health.lastTest.status === 'failed' ? 'test_failed' : null,
            health.retry.retryable ? 'retry_scheduled' : null,
            terminalFailure ? 'terminal_failure' : null,
            health.enabled && endpointPresent && health.lastTest.requestId && health.lastTest.status !== 'failed' ? 'verified' : null,
        ].filter(Boolean) as string[]
        const blockers = [
            ...policyBlockers.map(blocker => ({ ...blocker, destinationId: health.destinationId })),
            !health.enabled ? dashboardReadinessBlocker('disabled', 'Destination is disabled.', health.destinationId, 'destination_disabled') : null,
            endpointPresent ? null : dashboardReadinessBlocker('secret_missing', 'Destination has no stored webhook URL reference.', health.destinationId, 'secret_missing'),
            health.lastTest.status === 'failed' ? dashboardReadinessBlocker('test_failed', 'Latest destination test failed.', health.destinationId, 'test_failed') : null,
            health.retry.retryable ? dashboardReadinessBlocker('retry_scheduled', 'Latest failed delivery has retry/backoff scheduled.', health.destinationId, health.retry.errorClass || 'retry_scheduled', false) : null,
            terminalFailure ? dashboardReadinessBlocker('terminal_failure', 'Latest delivery failure is not retryable.', health.destinationId, health.lastFailure?.errorClass || latestRetryKey?.retry.lastErrorCategory || 'terminal_failure') : null,
        ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]
        const healthStatus = dashboardPrimaryHealthStatus(states)

        return {
            schemaVersion: 'dwm.webhook.dashboard_destination_readiness.v1',
            orgId: health.orgId,
            destinationId: health.destinationId,
            label: health.label,
            type: health.type,
            lifecycle: {
                status: health.status,
                enabled: health.enabled,
            },
            healthStatus,
            healthStates: [...new Set(states.length ? states : ['unverified'])],
            readyForDryRun: health.enabled && endpointPresent && !policyBlockers.length,
            readyForLive: health.ready && liveDeliveryEnabled && !policyBlockers.length,
            secretState: endpointPresent ? 'redacted' : 'missing',
            redactedEndpoint: health.redactedEndpoint,
            latestDeliveryProof: {
                requestId: health.latestAttempt?.requestId || null,
                deliveryId: health.latestAttempt?.deliveryId || null,
                status: health.latestAttempt?.status || null,
                rawStatus: health.latestAttempt?.rawStatus || null,
                dryRun: health.latestAttempt?.dryRun ?? null,
                live: health.latestAttempt?.live ?? null,
                replay: health.latestAttempt?.replay ?? null,
                dedupeKey: health.latestAttempt?.dedupeKey || latestRetryKey?.dedupeKey || null,
                idempotencyKey: health.latestAttempt?.idempotencyKey || latestRetryKey?.idempotencyKey || null,
                casePath: health.latestAttempt?.casePath || latestRetryKey?.casePath || null,
                auditEventId: health.latestAttempt?.auditEventId || latestRetryKey?.audit.latestAuditEventId || null,
                attemptedAt: health.latestAttempt?.attemptedAt || null,
            },
            test: {
                status: health.lastTest.status,
                requestId: health.lastTest.requestId,
                auditEventId: health.lastTest.auditEventId,
                failureReason: health.lastTest.failureReason,
            },
            retry: {
                retryable: health.retry.retryable,
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                terminalFailure,
            },
            replay: {
                duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
                latestReplayRequestId: health.recentAttempts.find(attempt => attempt.replay)?.requestId || null,
            },
            auditEventIds: health.auditEventIds,
            latestAuditEventId: health.latestAuditEventId,
            blockers: uniqueDashboardReadinessBlockers(blockers),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
        liveDeliveryEnabled,
        visibility: visibilityDecision,
        orgStatus: orgLifecycleStatus,
        watchlistStatus: watchlistLifecycleStatus,
        summary: {
            destinationCount: rows.length,
            verifiedCount: rows.filter(row => row.healthStates.includes('verified')).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
            retryScheduledCount: rows.filter(row => row.healthStates.includes('retry_scheduled')).length,
            terminalFailureCount: rows.filter(row => row.healthStates.includes('terminal_failure')).length,
            disabledCount: rows.filter(row => row.healthStates.includes('disabled')).length,
            policyBlockedCount: rows.filter(row => row.healthStates.includes('policy_blocked')).length,
        },
        blockers: uniqueDashboardReadinessBlockers([
            ...policyBlockers,
            ...rows.flatMap(row => row.blockers),
        ]),
        destinations: rows,
    }
}

export function buildDwmWebhookDestinationLifecycle({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }

    return healthRows.map((health) => {
        const audits = auditByDestination.get(health.destinationId) || []
        const created = audits.find(audit => audit.action === 'destination.created') || null
        const updated = audits.find(audit => audit.action === 'destination.updated') || null
        const disabled = audits.find(audit => audit.action === 'destination.archived') || null
        const replay = health.recentAttempts.find(attempt => attempt.eventType === 'dwm.alert.replayed') || null
        const adminAuditEvents = canManage ? audits : []

        return {
            schemaVersion: 'dwm.webhook.destination_lifecycle.v1',
            destinationId: health.destinationId,
            orgId: health.orgId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            view: canManage ? 'admin' : 'member',
            access: {
                role: clean(viewerRole) || null,
                canReadStatus: true,
                canManage,
                canUpdate: canManage,
                canTest: canManage,
                canDisable: canManage && health.enabled,
                memberSafe: !canManage,
            },
            redactedEndpoint: health.redactedEndpoint,
            lifecycle: {
                created: lifecycleEvent(created, canManage),
                updated: lifecycleEvent(updated, canManage),
                disabled: lifecycleEvent(disabled, canManage),
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastReplay: replay,
                lastDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                redactedEndpoint: health.redactedEndpoint,
            },
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
                idempotencyCoverage: health.idempotencyCoverage,
            },
            auditEventIds: health.auditEventIds,
            latestAuditEventId: health.latestAuditEventId,
            auditEventContracts: adminAuditEvents,
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
}

export function buildDwmWebhookDestinationCrudContract({
    action,
    ownerId,
    input = {},
    destination = null,
    destinations = [],
    deliveries = [],
    auditEvents = [],
    viewerRole = null,
    canManage = false,
    entitlementAllowed = true,
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    action: DwmWebhookDestinationCrudAction
    ownerId: string
    input?: DwmWebhookDestinationInput
    destination?: DwmWebhookDestinationPublic | null
    destinations?: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    viewerRole?: string | null
    canManage?: boolean
    entitlementAllowed?: boolean
    liveDeliveryEnabled?: boolean
}) {
    const requestId = firstClean(input.requestId, input.request_id)
    const rawEndpoint = firstClean(input.endpointUrl, input.endpoint_url, input.webhookUrl, input.webhook_url, input.url)
    const rawKind = firstClean(input.kind, input.type)
    const endpointValidation = validateWebhookEndpointForContract(rawEndpoint)
    const normalizedKind = WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)
        ? rawKind as DwmWebhookKind
        : endpointValidation.normalizedUrl
            ? parseKind(rawKind, endpointValidation.normalizedUrl, destination?.kind)
            : destination?.kind || 'webhook'
    const normalizedEndpointHash = endpointValidation.normalizedUrl ? hashValue('endpoint', endpointValidation.normalizedUrl) : destination?.endpointHash || null
    const normalizedEndpointHint = endpointValidation.normalizedUrl ? redactWebhookEndpoint(endpointValidation.normalizedUrl) : destination?.endpointHint || null
    const normalizedOrgId = firstClean(input.orgId, destination?.orgId, ownerId)
    const normalizedLabel = firstClean(input.name, input.label, input.channelName, input.channel_name, input.channel, destination?.name)
        || (normalizedKind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
    const status = parseStatus(input.status ?? destination?.status ?? (action === 'disable' ? 'paused' : 'active'))
    const scopedDestinations = destinations.filter(item => item.orgId === normalizedOrgId)
    const duplicate = normalizedEndpointHash
        ? scopedDestinations.find(item => item.endpointHash === normalizedEndpointHash && item.id !== destination?.id && item.status !== 'archived') || null
        : null
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: destination ? [destination] : scopedDestinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const proofRow = destination ? adminProof.destinations.find(item => item.destinationId === destination.id) || null : null
    const blockers: ReturnType<typeof crudBlocker>[] = []

    if (!canManage) {
        blockers.push(crudBlocker('permission_denied', 'Only organization owners and admins can manage webhook destinations.', destination?.id || null))
    }
    if (!entitlementAllowed || parseBoolean(input.entitlementAllowed ?? input.entitlement_allowed, true) === false) {
        blockers.push(crudBlocker('entitlement_plan_denied', 'Current plan does not allow another webhook destination.', destination?.id || null))
    }
    if (endpointValidation.error && (rawEndpoint || action === 'create')) {
        blockers.push(crudBlocker('invalid_url', endpointValidation.error, destination?.id || null))
    }
    if (rawKind && !WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)) {
        blockers.push(crudBlocker('unsupported_destination_type', 'Destination type must be discord or webhook.', destination?.id || null))
    }
    if (duplicate && action === 'create') {
        blockers.push(crudBlocker('duplicate_destination', 'An active destination already uses this endpoint for the organization.', duplicate.id))
    }
    if ((action === 'update' || action === 'disable' || action === 'enable' || action === 'test') && !destination) {
        blockers.push(crudBlocker('permission_denied', 'Webhook destination is not available for this organization.', null))
    }
    if ((action === 'disable' || action === 'test') && destination?.status !== 'active') {
        blockers.push(crudBlocker('destination_disabled', 'Destination is disabled.', destination?.id || null, false, action === 'test'))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_live_endpoint')) {
        blockers.push(crudBlocker('invalid_url', 'Destination has no valid webhook URL reference.', destination?.id || null))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_verified_dry_run')) {
        blockers.push(crudBlocker('no_verified_dry_run', 'Destination has no verified dry-run delivery yet.', destination?.id || null, action === 'test', false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'destination_unhealthy')) {
        blockers.push(crudBlocker('unhealthy_destination', 'Destination health is blocked or retrying.', destination?.id || null, Boolean(proofRow.retry.retryable), false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'audit_missing')) {
        blockers.push(crudBlocker('audit_missing', 'Destination has no linked audit event.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'dedupe_already_delivered')) {
        blockers.push(crudBlocker('idempotency_duplicate', 'Latest destination delivery idempotency key has already been delivered.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'retry_not_eligible')) {
        blockers.push(crudBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', destination?.id || null, false, false))
    }

    const uniqueBlockers = uniqueCrudBlockers(blockers)
    const blocking = uniqueBlockers.filter(blocker => blocker.blocking)
    return {
        schemaVersion: 'dwm.webhook.destination_crud.v1',
        action,
        requestId: requestId || null,
        ownerId,
        orgId: normalizedOrgId,
        canApply: blocking.length === 0,
        access: {
            role: clean(viewerRole) || null,
            canManage,
            canCreate: canManage,
            canUpdate: canManage && Boolean(destination),
            canDisable: canManage && destination?.status === 'active',
            canEnable: canManage && Boolean(destination) && destination?.status !== 'active',
            canTest: canManage && Boolean(destination),
            memberSafe: !canManage,
        },
        desired: {
            label: normalizedLabel.slice(0, 120),
            type: normalizedKind,
            kind: normalizedKind,
            channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
            status,
            events: parseEvents(input.events),
            redactedEndpoint: {
                endpointHint: normalizedEndpointHint,
                endpointHash: normalizedEndpointHash,
            },
        },
        destination: destination
            ? {
                id: destination.id,
                orgId: destination.orgId,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                enabled: destination.status === 'active',
                redactedEndpoint: {
                    endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                    endpointHash: destination.endpointHash,
                },
            }
            : null,
        duplicateDestinationId: duplicate?.id || null,
        blockers: uniqueBlockers,
        blockingCodes: blocking.map(blocker => blocker.code),
        health: proofRow
            ? {
                status: proofRow.health.status,
                ready: proofRow.health.ready,
                blockers: proofRow.health.adminProofBlockers,
                retry: proofRow.retry,
                audit: proofRow.audit,
                productProgress: adminProof.productProgress,
            }
            : {
                status: 'pending',
                ready: false,
                blockers: [],
                retry: null,
                audit: null,
                productProgress: adminProof.productProgress,
            },
        audit: {
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
            duplicateDestinationId: duplicate?.id || null,
        },
        noNetwork: true,
        liveDeliveryEnabled,
    }
}

export function buildDwmWebhookDestinationAdminProof({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const decision = visibility
        ? organizationVisibilityDecision(visibility)
        : {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members' as const,
            allowedRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
        }
    const access = {
        role: clean(viewerRole) || null,
        canRead: decision.allowed,
        canManage: decision.allowed && canManage,
        canTest: decision.allowed && canManage,
        canRetry: decision.allowed && canManage,
        memberSafe: decision.allowed && !canManage,
    }

    if (!decision.allowed) {
        const blocker = adminProofBlocker('permission_denied', 'Webhook destination health is not visible for this organization membership.')
        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
            liveDeliveryEnabled,
            visibility: decision,
            access,
            productProgress: webhookProductProgressSummary([], liveDeliveryEnabled, [blocker]),
            summary: destinationAdminProofSummary([], [], liveDeliveryEnabled),
            blockers: [blocker],
            destinations: [],
        }
    }

    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const lifecycleRows = buildDwmWebhookDestinationLifecycle({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const operations = buildDwmWebhookDeliveryOperations({ deliveries, auditEvents, destinations, liveDeliveryEnabled })
    const lifecycleByDestination = new Map(lifecycleRows.map(row => [row.destinationId, row]))
    const operationsByDestination = new Map<string, typeof operations.recentDeliveries>()
    for (const operation of operations.recentDeliveries) {
        if (!operation.destinationId) continue
        const rows = operationsByDestination.get(operation.destinationId) || []
        rows.push(operation)
        operationsByDestination.set(operation.destinationId, rows)
    }

    const proofs = healthRows.map((health) => {
        const lifecycle = lifecycleByDestination.get(health.destinationId) || null
        const destinationOperations = (operationsByDestination.get(health.destinationId) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestOrgAlert = destinationOperations.find(operation => operation.eventType !== 'dwm.alert.test') || null
        const latestReplay = destinationOperations.find(operation => operation.replay) || null
        const latestSent = destinationOperations.find(operation => operation.status === 'sent') || null
        const latestFailedOrSkipped = destinationOperations.find(operation => operation.status === 'failed' || operation.status === 'skipped') || null
        const blockers = destinationAdminProofBlockers({
            health,
            latestOrgAlert,
            latestSent,
            latestFailedOrSkipped,
        })

        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof_row.v1',
            orgId: health.orgId,
            destinationId: health.destinationId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            redactedEndpoint: health.redactedEndpoint,
            access: lifecycle?.access || access,
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                adminProofBlockers: blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
            },
            lifecycle: {
                created: lifecycle?.lifecycle.created || null,
                updated: lifecycle?.lifecycle.updated || null,
                disabled: lifecycle?.lifecycle.disabled || null,
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastLiveDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                eligible: access.canRetry && blockers.every(blocker => !['destination_disabled', 'no_live_endpoint', 'no_verified_dry_run', 'permission_denied', 'retry_not_eligible'].includes(blocker.code)),
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: lifecycle?.retry.requestId || health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: lifecycle?.retry.deliveryId || health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: lifecycle?.retry.dedupeKey || health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
            },
            deliveryOperations: {
                total: destinationOperations.length,
                recent: destinationOperations.slice(0, 5),
                latestOrgAlert,
            },
            dedupe: {
                duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
                covered: health.idempotencyCoverage.covered,
                latestDedupeKey: latestOrgAlert?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                alreadyDelivered: Boolean(latestSent),
                deliveredRequestId: latestSent?.requestId || null,
            },
            replay: {
                latestReplayRequestId: latestReplay?.requestId || null,
                latestReplayDedupeKey: latestReplay?.dedupeKey || null,
                replayAttemptCount: destinationOperations.filter(operation => operation.replay).length,
            },
            audit: {
                latestAuditEventId: health.latestAuditEventId,
                auditEventIds: health.auditEventIds,
                auditEventContracts: access.canManage ? health.auditEventContracts : [],
            },
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
    const blockers = uniqueAdminProofBlockers(proofs.flatMap(proof => proof.health.adminProofBlockers))

    return {
        schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
        liveDeliveryEnabled,
        visibility: decision,
        access,
        productProgress: webhookProductProgressSummary(proofs, liveDeliveryEnabled, blockers),
        summary: destinationAdminProofSummary(proofs, operations.recentDeliveries, liveDeliveryEnabled),
        blockers,
        destinations: proofs,
    }
}

export function buildDwmOrgAlertWebhookDeliveryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const dispatchDestinations = destinations.map(destination => ({
        id: destination.id,
        org_id: destination.orgId,
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: destination.events,
    }))
    const dispatch = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input: normalizedInput,
        destinations: dispatchDestinations,
    })
    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const destinationLifecycle = buildDwmWebhookDestinationLifecycle({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const destinationAdminProof = buildDwmWebhookDestinationAdminProof({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const auditEventContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const alertDestinationReadiness = buildDwmAlertWebhookReadinessHandoff({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery.v1',
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedCount: dispatch.selectedDestinations.length,
            skippedCount: dispatch.skippedDestinations.length,
            selectedDestinations: dispatch.selectedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.org_id,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                idempotencyKey: buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            })),
            skippedDestinations: dispatch.skippedDestinations,
        },
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            evidenceSummary: normalizedAlert.evidenceSummary,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenance: normalizedAlert.provenance,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        deliveryLedger,
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
        alertDestinationReadiness,
        auditEventContracts,
    }
}

export function buildDwmAlertWebhookReadinessHandoff({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.created')
    const dispatchDestinations = destinations.map(destination => ({
        id: destination.id,
        org_id: destination.orgId,
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: destination.events,
    }))
    const dispatch = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input: normalizedInput,
        destinations: dispatchDestinations,
    })
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const orgDestinations = destinations.filter(destination => destination.orgId === dispatch.orgId)
    const orgDeliveries = deliveries.filter(delivery => delivery.orgId === dispatch.orgId)
    const orgAuditEvents = auditEvents.filter(audit => audit.orgId === dispatch.orgId)
    const destinationReadiness = buildDwmWebhookDeliveryReadiness({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
    })
    const destinationHealth = buildDwmWebhookDestinationHealth({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
    })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
        filters: {
            orgId: dispatch.orgId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        },
    })
    const selectedDestinationIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const selectedRetryKeys = retryPersistence.deliveryKeys
        .filter(key => key.destinationId && selectedDestinationIds.has(key.destinationId))
    const blockers: Array<{
        code: string
        message: string
        destinationId: string | null
        blocking: boolean
    }> = []

    if (!dispatch.orgId) blockers.push(alertReadinessBlocker('missing_org', 'Organization context is required for customer webhook delivery.'))
    if (!normalizedAlert.id && !normalizedAlert.dedupeKey) blockers.push(alertReadinessBlocker('missing_alert_context', 'Alert id or dedupe key is required for customer webhook delivery.'))
    if (!watchlist.id && !watchlist.name && watchlist.terms.length === 0) blockers.push(alertReadinessBlocker('missing_watchlist_context', 'Watchlist identity or matched term is required for customer context.'))
    if (!normalizedAlert.sourceFamily || normalizedAlert.sourceFamily === 'dark_web' && !normalizedAlert.provenanceSummary) blockers.push(alertReadinessBlocker('missing_source_proof', 'Source family or provenance proof is required for customer delivery.'))
    if (normalizedAlert.evidenceCount <= 0) blockers.push(alertReadinessBlocker('missing_evidence', 'At least one evidence item is required for customer delivery.'))
    if (dispatch.selectedDestinations.length === 0) blockers.push(alertReadinessBlocker('no_enabled_destination', 'No enabled destination is selected for this org alert.'))
    for (const skipped of dispatch.skippedDestinations) {
        if (skipped.reason === 'disabled') blockers.push(alertReadinessBlocker('destination_disabled', 'A destination exists but is disabled for this alert event.', skipped.id))
        if (skipped.reason === 'event_not_subscribed') blockers.push(alertReadinessBlocker('event_not_subscribed', 'A destination is not subscribed to this alert event.', skipped.id, false))
    }
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(alertReadinessBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    for (const key of selectedRetryKeys) {
        if (key.dedupe.alreadyDelivered) blockers.push(alertReadinessBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the alert idempotency key.', key.destinationId, false))
        if (key.retry.retryable) blockers.push(alertReadinessBlocker('retry_scheduled', 'The latest failed delivery has retry/backoff scheduled.', key.destinationId, false))
        if (key.retry.terminalFailure) blockers.push(alertReadinessBlocker('terminal_failure', 'The latest delivery failed with a non-retryable error.', key.destinationId))
    }
    const uniqueBlockers = uniqueAlertReadinessBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const ready = dispatch.selectedDestinations.length > 0 && blockingCodes.length === 0

    return {
        schemaVersion: 'dwm.webhook.alert_readiness_handoff.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        tenantId: clean(normalizedInput.tenantId) || dispatch.orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        ready,
        state: ready ? 'ready' : dispatch.selectedDestinations.length > 0 ? 'blocked' : 'missing_destination',
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        destinationSelection: {
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        destinationReadiness,
        destinationHealth,
        deliveryRetryPersistence: retryPersistence,
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
        const normalizedAlert = normalizeAlert(plan.alert)
        const idempotencyKey = buildIdempotencyKey(plan.eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
        const deliveredDuplicate = live && !dryRun
            ? await findDeliveredDwmWebhookDelivery(ownerId, destination.org_id, destination.id, idempotencyKey)
            : null
        if (deliveredDuplicate) {
            deliveries.push(await recordSkippedDuplicateDwmWebhookDelivery({
                ownerId,
                destination: destination as DwmWebhookDestinationRow,
                eventType: plan.eventType,
                alert: plan.alert,
                priorDelivery: deliveredDuplicate,
            }))
            continue
        }
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

async function recordSkippedDuplicateDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    priorDelivery,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    priorDelivery: DwmWebhookDeliveryRow
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination, alert, eventType, deliveryId })
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const payloadHash = hashValue('payload', JSON.stringify(payload))
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const error = 'Delivery skipped because this destination already has a delivered attempt for the same idempotency key.'
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
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', FALSE, $7, $8, $9, $10::JSONB, NULL, NULL, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *
    `, [
        deliveryId,
        destination.id,
        ownerId,
        destination.org_id,
        normalizedAlert.id,
        eventType,
        destination.endpoint_hint,
        destination.endpoint_hash,
        payloadHash,
        JSON.stringify(payload),
        error,
        idempotencyKey,
        watchlist.id,
        watchlist.name,
        normalizedAlert.route,
        normalizedAlert.casePath,
    ])

    const delivery = result.rows[0] as DwmWebhookDeliveryRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: destination.id,
        deliveryId: delivery.id,
        action: 'delivery.skipped',
        metadata: {
            alertId: delivery.alert_id,
            eventType: delivery.event_type,
            status: delivery.status,
            endpointHint: delivery.endpoint_hint,
            endpointHash: delivery.endpoint_hash,
            payloadHash: delivery.payload_hash,
            dryRun: delivery.dry_run,
            error: delivery.error,
            idempotencyKey: delivery.idempotency_key,
            priorDeliveryId: priorDelivery.id,
            priorDeliveredAt: priorDelivery.attempted_at,
            reason: 'duplicate_delivered_idempotency_key',
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

async function findDeliveredDwmWebhookDelivery(
    ownerId: string,
    orgId: string,
    destinationId: string,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE owner_id = $1
          AND org_id = $2
          AND destination_id = $3
          AND idempotency_key = $4
          AND status = 'delivered'
        ORDER BY attempted_at DESC
        LIMIT 1
    `, [ownerId, orgId, destinationId, idempotencyKey])

    return (result.rows as DwmWebhookDeliveryRow[])[0] || null
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

function webhookAuditCategory(action: string) {
    if (action.startsWith('destination.')) return 'destination'
    if (action.startsWith('delivery.')) return 'delivery'
    return 'webhook'
}

function webhookAuditOutcome(action: string, status?: string | null) {
    if (action === 'destination.created') return 'created'
    if (action === 'destination.updated') return 'updated'
    if (action === 'destination.archived') return 'disabled'
    if (action === 'delivery.tested') return 'tested'
    if (action === 'delivery.replayed') return status || 'replayed'
    if (action === 'delivery.failed') return 'failed'
    if (action === 'delivery.delivered') return 'sent'
    if (action === 'delivery.skipped') return 'skipped'
    if (action === 'delivery.dry_run') return 'dry_run'
    return status || action.split('.').pop() || 'unknown'
}

function webhookAuditSeverity(action: string, status?: string | null) {
    const outcome = webhookAuditOutcome(action, status)
    if (outcome === 'failed') return 'error'
    if (outcome === 'skipped' || outcome === 'disabled') return 'warning'
    return 'info'
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

function destinationHealthAttempt(
    attempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number],
    auditEventId: string | null
) {
    return {
        requestId: attempt.requestId,
        deliveryId: attempt.deliveryId,
        alertId: attempt.alertId,
        eventType: attempt.eventType,
        status: attempt.status,
        rawStatus: attempt.rawStatus,
        dryRun: attempt.dryRun,
        live: attempt.live,
        liveRequested: attempt.liveRequested,
        replay: attempt.replay,
        idempotencyKey: attempt.idempotencyKey,
        dedupeKey: attempt.dedupeKey,
        route: attempt.route,
        casePath: attempt.casePath,
        responseStatus: attempt.responseStatus,
        responseSummary: attempt.responseSummary,
        error: attempt.error,
        errorClass: attempt.errorClass,
        retryable: attempt.retryable,
        nextRetryAt: attempt.nextRetryAt,
        retryReason: attempt.retryReason,
        attemptCount: attempt.attemptCount,
        payloadHash: attempt.payloadHash,
        auditEventId: attempt.auditEventId || auditEventId,
        auditAction: attempt.auditAction,
        attemptedAt: attempt.attemptedAt,
        createdAt: attempt.createdAt,
    }
}

function auditEventIdForDelivery(
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>,
    deliveryId?: string | null
) {
    if (!deliveryId) return null
    return audits.find(audit => audit.deliveryId === deliveryId)?.auditEventId || null
}

function lifecycleEvent(
    audit: ReturnType<typeof buildDwmWebhookAuditEventContracts>[number] | null,
    includeActor: boolean
) {
    if (!audit) return null
    return {
        auditEventId: audit.auditEventId,
        action: audit.action,
        outcome: audit.outcome,
        severity: audit.severity,
        actorId: includeActor ? audit.actorId : null,
        requestId: audit.requestId,
        createdAt: audit.createdAt,
    }
}

function operationBlocker(
    code: DwmWebhookDeliveryOperationBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return { code, message, destinationId, retryable }
}

function uniqueOperationBlockers(blockers: ReturnType<typeof operationBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof operationBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function retryQueueBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueRetryQueueBlockers(blockers: ReturnType<typeof retryQueueBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof retryQueueBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function destinationMatrixBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueDestinationMatrixBlockers(blockers: ReturnType<typeof destinationMatrixBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof destinationMatrixBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function alertReadinessBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueAlertReadinessBlockers(blockers: ReturnType<typeof alertReadinessBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof alertReadinessBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function dashboardReadinessBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    reason: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, reason, blocking }
}

function uniqueDashboardReadinessBlockers(blockers: ReturnType<typeof dashboardReadinessBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof dashboardReadinessBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}:${blocker.reason || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function dashboardPrimaryHealthStatus(states: string[]) {
    const priority = [
        'policy_blocked',
        'disabled',
        'secret_missing',
        'test_failed',
        'terminal_failure',
        'retry_scheduled',
        'verified',
    ]
    for (const status of priority) {
        if (states.includes(status)) return status
    }
    return 'unverified'
}

function destinationHealthStates(health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const terminalFailure = Boolean(
        health.lastFailure
        && !health.lastFailure.retryable
        && health.lastFailure.errorClass !== 'live_delivery_disabled'
    )
    const states = [
        !health.enabled ? 'disabled' : null,
        endpointPresent ? null : 'secret_missing',
        health.lastTest.status === 'failed' ? 'test_failed' : null,
        health.retry.retryable ? 'retry_scheduled' : null,
        terminalFailure ? 'terminal_failure' : null,
        health.enabled && endpointPresent && health.lastTest.requestId && health.lastTest.status !== 'failed' ? 'verified' : null,
    ].filter(Boolean) as string[]
    return [...new Set(states.length ? states : ['unverified'])]
}

function validateWebhookEndpointForContract(rawEndpoint: string) {
    if (!rawEndpoint) return { normalizedUrl: null, error: 'endpointUrl is required.' }
    try {
        const url = new URL(rawEndpoint)
        if (url.protocol !== 'https:') {
            return { normalizedUrl: null, error: 'Webhook destinations must use HTTPS.' }
        }
        return { normalizedUrl: url.toString(), error: null }
    } catch {
        return { normalizedUrl: null, error: 'endpointUrl must be a valid URL.' }
    }
}

function crudBlocker(
    code: DwmWebhookDestinationCrudBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false,
    blocking = true
) {
    return { code, message, destinationId, retryable, blocking }
}

function uniqueCrudBlockers(blockers: ReturnType<typeof crudBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof crudBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function adminProofBlocker(
    code: DwmWebhookDestinationAdminProofBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return { code, message, destinationId, retryable }
}

function destinationAdminProofBlockers({
    health,
    latestOrgAlert,
    latestSent,
    latestFailedOrSkipped,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    latestOrgAlert: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestSent: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestFailedOrSkipped: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
}) {
    const blockers: ReturnType<typeof adminProofBlocker>[] = []
    if (!health.enabled) {
        blockers.push(adminProofBlocker('destination_disabled', 'Destination is disabled.', health.destinationId))
    }
    if (!health.lastTest.requestId || (health.lastTest.status !== 'dry_run' && health.lastTest.status !== 'delivered')) {
        blockers.push(adminProofBlocker('no_verified_dry_run', 'Destination has no successful dry-run/test delivery.', health.destinationId))
    }
    if (!health.redactedEndpoint.endpointHash || !health.redactedEndpoint.endpointHint) {
        blockers.push(adminProofBlocker('no_live_endpoint', 'Destination has no stored webhook endpoint reference.', health.destinationId))
    }
    if (!health.latestAuditEventId && health.auditEventIds.length === 0) {
        blockers.push(adminProofBlocker('audit_missing', 'Destination has no linked webhook audit event.', health.destinationId))
    }
    if (!health.ready && health.enabled) {
        blockers.push(adminProofBlocker('destination_unhealthy', 'Destination health is blocked or retrying.', health.destinationId, health.retry.retryable))
    }
    if (!latestOrgAlert) {
        blockers.push(adminProofBlocker('missing_org_alert_context', 'No org alert delivery or replay has been recorded for this destination.', health.destinationId))
    }
    if (latestSent) {
        blockers.push(adminProofBlocker('dedupe_already_delivered', 'A delivery has already been sent for the latest destination dedupe context.', health.destinationId))
    }
    if (latestFailedOrSkipped && !latestFailedOrSkipped.attempts.retryable && latestFailedOrSkipped.status !== 'queued') {
        blockers.push(adminProofBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', health.destinationId))
    }
    return uniqueAdminProofBlockers(blockers)
}

function uniqueAdminProofBlockers(blockers: ReturnType<typeof adminProofBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof adminProofBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
}

function destinationAdminProofSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean }
        retry: { retryable: boolean }
        dedupe: { duplicateKeyCount: number, alreadyDelivered: boolean }
        replay: { replayAttemptCount: number }
    }>,
    operations: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'],
    liveDeliveryEnabled: boolean
) {
    return {
        destinationCount: proofs.length,
        activeDestinationCount: proofs.filter(proof => proof.enabled).length,
        readyDestinationCount: proofs.filter(proof => proof.health.ready).length,
        blockedDestinationCount: proofs.filter(proof => !proof.health.ready).length,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        replayDestinationCount: proofs.filter(proof => proof.replay.replayAttemptCount > 0).length,
        dedupeDeliveredCount: proofs.filter(proof => proof.dedupe.alreadyDelivered).length,
        duplicateDedupeDestinationCount: proofs.filter(proof => proof.dedupe.duplicateKeyCount > 0).length,
        recentDeliveryCount: operations.length,
        liveDeliveryEnabled,
    }
}

function webhookProductProgressSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean, adminProofBlockers: ReturnType<typeof adminProofBlocker>[] }
        retry: { retryable: boolean }
        deliveryOperations: { latestOrgAlert: unknown }
    }>,
    liveDeliveryEnabled: boolean,
    blockers: ReturnType<typeof adminProofBlocker>[]
) {
    const activeDestinationCount = proofs.filter(proof => proof.enabled).length
    const deliveryReadyCount = proofs.filter(proof => proof.enabled && proof.health.ready && proof.deliveryOperations.latestOrgAlert).length
    const blockerCodes = [...new Set(blockers.map(blocker => blocker.code))]
    return {
        schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
        status: activeDestinationCount > 0 && deliveryReadyCount > 0 && !blockerCodes.includes('permission_denied') ? 'ready' : 'needs_action',
        destinationCount: proofs.length,
        activeDestinationCount,
        deliveryReadyCount,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        liveDeliveryEnabled,
        blockerCodes,
        href: '/dashboard/automations?setup=dwm',
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

function redactAuditContractMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (/endpoint|secret|token|password|credential|url/i.test(key) && key !== 'endpointHint') {
            redacted[key] = '[redacted]'
        } else if (typeof value === 'string') {
            redacted[key] = redactDeliveryEvidenceText(truncate(value, 1000))
        } else if (Array.isArray(value)) {
            redacted[key] = value.map(item => typeof item === 'string' ? redactDeliveryEvidenceText(truncate(item, 1000)) : item)
        } else if (value && typeof value === 'object') {
            redacted[key] = redactAuditContractMetadata(value as Record<string, unknown>)
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
