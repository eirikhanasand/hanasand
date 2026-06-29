import crypto from 'node:crypto'
import run from '#db'
import { organizationVisibilityDecision, type OrganizationRole, type OrganizationVisibilityDecisionInput } from '#utils/organizations.ts'

export type DwmWebhookKind = 'webhook' | 'discord'
export type DwmWebhookStatus = 'active' | 'paused' | 'archived'
export type DwmAlertEventType = 'dwm.alert.created' | 'dwm.alert.updated' | 'dwm.alert.replayed' | 'dwm.alert.test'

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
    error_class: string | null
    attempt_count: number | null
    next_retry_at: string | null
    idempotency_key: string
    watchlist_id: string | null
    watchlist_name: string | null
    route: string | null
    case_path: string | null
    attempted_at: string
    created_at: string
    updated_at?: string
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

export type DwmAlertWebhookSkippedDeliveryIntent = {
    destinationId: string
    orgId: string
    status: DwmWebhookStatus
    reason: 'disabled' | 'event_not_subscribed'
    idempotencyKey: string
    error: string
    persistable: true
}

export type DwmAlertWebhookMissingDeliveryIntent = {
    orgId: string
    reason: 'missing_destination' | 'requested_destination_not_found'
    requestedDestinationId: string | null
    idempotencyKey: string
    error: string
    persistable: true
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
    | 'destination_unavailable'
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
export type DwmWebhookDestinationCrudAction = 'create' | 'update' | 'disable' | 'delete' | 'enable' | 'test'
export type DwmWebhookDestinationCrudBlockerCode =
    | 'invalid_url'
    | 'unsupported_destination_type'
    | 'duplicate_destination'
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'unhealthy_destination'
    | 'entitlement_plan_denied'
    | 'permission_denied'
    | 'org_scope_mismatch'
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

const DEFAULT_EVENTS: DwmAlertEventType[] = ['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed']
const EVENT_TYPES = new Set<DwmAlertEventType>(['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed', 'dwm.alert.test'])
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
    const delivery = {
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
        errorClass: row.error_class,
        attemptCount: row.attempt_count ?? null,
        nextRetryAt: row.next_retry_at,
        idempotencyKey: row.idempotency_key,
        watchlistId: row.watchlist_id,
        watchlistName: row.watchlist_name,
        route: row.route,
        casePath: row.case_path,
        attemptedAt: row.attempted_at,
        createdAt: row.created_at,
    }
    return {
        ...delivery,
        ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
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
                updatedAt: delivery.updatedAt || delivery.createdAt,
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
        const attemptCount = delivery ? delivery.attemptCount || attemptCounts.get(delivery.idempotencyKey || delivery.id) || 1 : 1
        const errorClass = delivery?.errorClass ?? retryPlan.errorClass
        const nextRetryAt = delivery?.nextRetryAt ?? retryPlan.nextRetryAt

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
            errorClass,
            attemptCount,
            attemptedAt: item.attemptedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            nextRetryAt,
            retryable: Boolean(nextRetryAt) || retryPlan.retryable,
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
        const availability = deliveryDestinationAvailability(attempt)
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
                label: destination?.name || availability.label,
                type: destination?.kind || availability.type,
                status: destination?.status || availability.status,
                enabled: destination ? destination.status === 'active' : false,
                redactedEndpoint: attempt.redactedDestination,
                availability,
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
            updatedAt: attempt.updatedAt,
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
                updatedAt: operation.updatedAt,
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
            sanitizedPayloadPreview: preview?.sanitizedPayloadPreview || null,
            operationLinks: preview?.operationLinks || null,
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

export function buildDwmWebhookDeliveryPersistenceProof({
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
    const history = buildDwmWebhookDeliveryHistory({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const rows = history.entries.map((entry) => {
        const replayBlockers = deliveryPersistenceReplayBlockers(entry, liveDeliveryEnabled)
        const dryRunReplayBlocked = replayBlockers.filter(blocker => blocker.blocking && blocker.code !== 'live_delivery_disabled')
        const replayIdempotencyKey = [
            'dwm.alert.replayed',
            entry.orgId,
            entry.destinationId,
            entry.alert.dedupeKey,
        ].filter(Boolean).join(':')
        const replayBody = entry.orgId && entry.destinationId && entry.alert.id && entry.alert.dedupeKey
            ? {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                caseId: entry.alert.caseId,
                casePath: entry.alert.casePath,
                dedupeKey: entry.alert.dedupeKey,
                eventType: 'dwm.alert.replayed' as const,
                dryRun: true,
                live: false,
                idempotencyKey: replayIdempotencyKey,
            }
            : null
        return {
            schemaVersion: 'dwm.webhook.delivery_persistence_row.v1',
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            caseId: entry.alert.caseId,
            casePath: entry.alert.casePath,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            replay: entry.replay,
            eventType: entry.eventType,
            dedupeKey: entry.alert.dedupeKey,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            payloadHash: entry.deliveryProof.payloadHash,
            sanitizedPayloadPreview: entry.sanitizedPayloadPreview,
            responseSummary: entry.deliveryProof.response.summary,
            error: entry.deliveryProof.error,
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
            },
            audit: {
                auditEventId: entry.deliveryProof.auditEventId,
                auditAction: entry.deliveryProof.auditAction,
                expectedAuditActions: entry.replay
                    ? ['delivery.replayed', 'delivery.failed', 'delivery.retry_scheduled']
                    : ['delivery.created', 'delivery.failed', 'delivery.retry_scheduled'],
            },
            actionRequests: {
                deliveryHistory: {
                    method: 'GET' as const,
                    route: 'GET /api/dwm/webhook-deliveries',
                    query: {
                        orgId: entry.orgId,
                        destinationId: entry.destinationId,
                        alertId: entry.alert.id,
                        casePath: entry.alert.casePath,
                        dedupeKey: entry.alert.dedupeKey,
                        deliveryId: entry.deliveryId,
                    },
                    expectedAuditActions: ['delivery.created', 'delivery.replayed', 'delivery.failed', 'delivery.retry_scheduled'],
                    noNetwork: true as const,
                },
                dryRunReplay: {
                    method: 'POST' as const,
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: replayBody !== null && dryRunReplayBlocked.length === 0,
                    noNetwork: true as const,
                    body: replayBody,
                    expectedAuditAction: 'delivery.replayed',
                    blockers: dryRunReplayBlocked,
                },
                liveReplay: {
                    method: 'POST' as const,
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: replayBody !== null && liveDeliveryEnabled && replayBlockers.length === 0,
                    noNetwork: true as const,
                    body: replayBody ? { ...replayBody, dryRun: false, live: true } : null,
                    expectedAuditAction: 'delivery.replayed',
                    blockers: replayBlockers,
                },
            },
            operationLinks: entry.operationLinks,
            timestamps: {
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                attemptedAt: entry.deliveryProof.attemptedAt,
            },
        }
    })
    const blockers = rows.length
        ? []
        : [{
            code: 'missing_delivery_attempt',
            ownerLane: 'webhook',
            path: 'deliveryHistory.entries',
            message: 'No persisted webhook delivery attempts matched the requested filters.',
            blocking: true,
        }]
    const auditEventIds = [...new Set(rows.map(row => row.audit.auditEventId).filter(Boolean) as string[])]

    return {
        schemaVersion: 'dwm.webhook.delivery_persistence_proof.v1',
        liveDeliveryEnabled,
        filters: history.filters,
        ok: blockers.length === 0,
        redacted: true,
        totals: {
            rows: rows.length,
            persisted: rows.filter(row => row.status === 'sent' || row.dryRun).length,
            failed: rows.filter(row => row.status === 'failed').length,
            skipped: rows.filter(row => row.status === 'skipped').length,
            retryScheduled: rows.filter(row => row.retry.retryable).length,
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            replay: rows.filter(row => row.replay).length,
            auditLinked: auditEventIds.length,
        },
        audit: {
            eventType: 'dwm.webhook.delivery_persistence_checked',
            outcome: blockers.length === 0 ? 'ready' : 'blocked',
            auditEventIds,
        },
        blockers,
        rows,
    }
}

function deliveryPersistenceReplayBlockers(
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number],
    liveDeliveryEnabled: boolean
) {
    const blockers: ReturnType<typeof retryQueueBlocker>[] = []
    if (!entry.orgId || !entry.destinationId || !entry.alert.id || !entry.alert.dedupeKey) {
        blockers.push(retryQueueBlocker('missing_alert_context', 'Replay requires organization, destination, alert, and dedupe context.', entry.destinationId, true))
    }
    if (entry.destination.availability.state === 'missing_destination') {
        blockers.push(retryQueueBlocker('destination_unavailable', entry.destination.availability.message, entry.destinationId, true))
    }
    if (entry.retry.terminalFailure) {
        blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and should be remediated before replay.', entry.destinationId, true))
    }
    if (entry.dedupe.alreadyDelivered && entry.status === 'skipped') {
        blockers.push(retryQueueBlocker('dedupe_already_delivered', 'A live delivery already exists for this destination and idempotency key.', entry.destinationId, true))
    }
    if (!liveDeliveryEnabled) {
        blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; replay proof is dry-run only.', entry.destinationId, false))
    }
    return uniqueRetryQueueBlockers(blockers)
}

export function buildDwmWebhookDeliveryReceipts({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
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
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
    }
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery receipts are not visible for this organization membership.', normalizedFilters.destinationId, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_receipts.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                sent: 0,
                failed: 0,
                skipped: 0,
                dryRun: 0,
                live: 0,
                replay: 0,
                retryable: 0,
                auditLinked: 0,
                blocked: 1,
            },
            blockers: [permissionBlocker],
            receipts: [],
        }
    }

    const history = buildDwmWebhookDeliveryHistory({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const retryByIdempotencyKey = new Map(retryPersistence.deliveryKeys.map(key => [key.idempotencyKey, key]))
    const receipts = history.entries.map((entry) => {
        const retryKey = entry.deliveryProof.idempotencyKey
            ? retryByIdempotencyKey.get(entry.deliveryProof.idempotencyKey) || null
            : null
        const destinationUnavailable = !entry.destinationId
        const blockers = []
        if (entry.destinationId && entry.destination.status && entry.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled.', entry.destinationId, true))
        if (destinationUnavailable) blockers.push(retryQueueBlocker('destination_unavailable', entry.destination.availability.message, null, true))
        if (entry.liveRequested && !liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, false))
        if (entry.status === 'skipped') blockers.push(retryQueueBlocker('delivery_skipped', 'Delivery attempt was skipped before external send.', entry.destinationId, true))
        if (entry.dedupe.alreadyDelivered && entry.status === 'skipped') blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', entry.destinationId, true))
        if (entry.retry.retryable) blockers.push(retryQueueBlocker('retry_scheduled', 'Delivery is retryable and has retry/backoff metadata.', entry.destinationId, false))
        if (!destinationUnavailable && entry.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', entry.destinationId, true))
        if (!entry.deliveryProof.auditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Delivery receipt has no linked audit event yet.', entry.destinationId, false))
        const uniqueBlockers = uniqueRetryQueueBlockers(blockers)
        const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)

        return {
            schemaVersion: 'dwm.webhook.delivery_receipt.v1',
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            eventType: entry.eventType,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            liveRequested: entry.liveRequested,
            replay: entry.replay,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey: entry.alert.dedupeKey,
            route: retryKey?.route || null,
            casePath: entry.alert.casePath,
            alertUrl: entry.alert.alertUrl,
            watchlist: entry.watchlist,
            destination: entry.destination,
            proof: {
                payloadHash: entry.deliveryProof.payloadHash,
                auditEventId: entry.deliveryProof.auditEventId,
                auditAction: entry.deliveryProof.auditAction,
                attemptedAt: entry.deliveryProof.attemptedAt,
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                response: entry.deliveryProof.response,
                error: entry.deliveryProof.error,
                noNetwork: entry.dryRun || !entry.live,
                externalSendEnabled: entry.live && liveDeliveryEnabled,
            },
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: destinationUnavailable ? false : entry.retry.terminalFailure,
            },
            dedupe: {
                alreadyDelivered: entry.dedupe.alreadyDelivered,
                duplicateAttemptCount: entry.dedupe.duplicateAttemptCount,
                latestDedupeKey: retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey,
            },
            discordPreview: entry.discordPreview,
            sanitizedPayloadPreview: entry.sanitizedPayloadPreview,
            operationLinks: entry.operationLinks,
            blockers: uniqueBlockers,
            blockingCodes,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_receipts.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: receipts.some(receipt => receipt.proof.externalSendEnabled),
        visibility: decision,
        access,
        filters: history.filters,
        counts: {
            total: receipts.length,
            sent: receipts.filter(receipt => receipt.status === 'sent').length,
            failed: receipts.filter(receipt => receipt.status === 'failed').length,
            skipped: receipts.filter(receipt => receipt.status === 'skipped').length,
            dryRun: receipts.filter(receipt => receipt.dryRun).length,
            live: receipts.filter(receipt => receipt.live).length,
            replay: receipts.filter(receipt => receipt.replay).length,
            retryable: receipts.filter(receipt => receipt.retry.retryable).length,
            auditLinked: receipts.filter(receipt => Boolean(receipt.proof.auditEventId)).length,
            blocked: receipts.filter(receipt => receipt.blockingCodes.length > 0).length,
        },
        blockers: uniqueRetryQueueBlockers(receipts.flatMap(receipt => receipt.blockers)),
        receipts,
    }
}

export function buildDwmWebhookDeliveryTimeline({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const groups = new Map<string, typeof receipts.receipts>()
    for (const receipt of receipts.receipts) {
        const key = [
            receipt.orgId,
            receipt.alertId || receipt.dedupeKey || receipt.casePath || receipt.deliveryId,
            receipt.dedupeKey || receipt.casePath || receipt.alertId || receipt.deliveryId,
        ].join(':')
        const rows = groups.get(key) || []
        rows.push(receipt)
        groups.set(key, rows)
    }
    const timelines = [...groups.values()].map((rows) => {
        const sorted = [...rows].sort((a, b) => String(b.proof.attemptedAt || b.proof.createdAt).localeCompare(String(a.proof.attemptedAt || a.proof.createdAt)))
        const latest = sorted[0]
        const destinationIds = [...new Set(sorted.map(row => row.destinationId).filter(Boolean) as string[])]
        const auditEventIds = [...new Set(sorted.map(row => row.proof.auditEventId).filter(Boolean) as string[])]
        const blockers = uniqueRetryQueueBlockers(sorted.flatMap(row => row.blockers))
        const sentCount = sorted.filter(row => row.status === 'sent').length
        const failedCount = sorted.filter(row => row.status === 'failed').length
        const skippedCount = sorted.filter(row => row.status === 'skipped').length
        const retryableCount = sorted.filter(row => row.retry.retryable).length
        const terminalFailureCount = sorted.filter(row => row.retry.terminalFailure).length
        const status = sentCount > 0
            ? 'delivered'
            : retryableCount > 0
                ? 'retry_scheduled'
                : terminalFailureCount > 0
                    ? 'terminal_failure'
                    : failedCount > 0
                        ? 'failed'
                        : skippedCount === sorted.length
                            ? 'skipped'
                            : 'pending'

        return {
            schemaVersion: 'dwm.webhook.delivery_timeline_entry.v1',
            orgId: latest.orgId,
            alertId: latest.alertId,
            dedupeKey: latest.dedupeKey,
            casePath: latest.casePath,
            alertUrl: latest.alertUrl,
            route: latest.route,
            watchlist: latest.watchlist,
            status,
            latestDeliveryId: latest.deliveryId,
            latestRequestId: latest.requestId,
            latestAttemptedAt: latest.proof.attemptedAt,
            destinationIds,
            destinationCount: destinationIds.length,
            auditEventIds,
            latestAuditEventId: auditEventIds[0] || null,
            counts: {
                receipts: sorted.length,
                sent: sentCount,
                failed: failedCount,
                skipped: skippedCount,
                dryRun: sorted.filter(row => row.dryRun).length,
                live: sorted.filter(row => row.live).length,
                replay: sorted.filter(row => row.replay).length,
                retryable: retryableCount,
                terminalFailure: terminalFailureCount,
                blocked: sorted.filter(row => row.blockingCodes.length > 0).length,
            },
            retry: {
                nextRetryAt: sorted.find(row => row.retry.nextRetryAt)?.retry.nextRetryAt || null,
                lastErrorCategory: sorted.find(row => row.retry.lastErrorCategory)?.retry.lastErrorCategory || null,
                retryable: retryableCount > 0,
                terminalFailure: terminalFailureCount > 0,
            },
            latestReceipt: latest,
            operationLinks: latest.operationLinks,
            receipts: sorted.slice(0, 10),
            blockers,
            blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
        }
    }).sort((a, b) => String(b.latestAttemptedAt).localeCompare(String(a.latestAttemptedAt)))

    return {
        schemaVersion: 'dwm.webhook.delivery_timeline.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: receipts.externalSendEnabled,
        visibility: receipts.visibility,
        access: receipts.access,
        filters: receipts.filters,
        counts: {
            timelines: timelines.length,
            receipts: receipts.counts.total,
            delivered: timelines.filter(item => item.status === 'delivered').length,
            retryScheduled: timelines.filter(item => item.status === 'retry_scheduled').length,
            terminalFailure: timelines.filter(item => item.status === 'terminal_failure').length,
            blocked: timelines.filter(item => item.blockingCodes.length > 0).length,
            auditLinked: timelines.filter(item => Boolean(item.latestAuditEventId)).length,
        },
        blockers: receipts.blockers,
        timelines,
    }
}

export function buildDwmWebhookDeliveryActionPlan({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const timeline = buildDwmWebhookDeliveryTimeline({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryByIdempotencyKey = new Map(retryRequest.entries.map(entry => [entry.idempotencyKey, entry]))
    const destinationTestsById = new Map(destinations.map(destination => {
        const test = buildDwmWebhookDestinationTestContract({
            destination,
            deliveries,
            auditEvents,
            liveDeliveryEnabled,
            viewerRole,
            canManage,
        })
        return [destination.id, test]
    }))
    const actions = timeline.timelines.map((item) => {
        const latest = item.latestReceipt
        const retryEntry = latest.idempotencyKey ? retryByIdempotencyKey.get(latest.idempotencyKey) || null : null
        const destinationDisabled = latest.destinationId && latest.destination.status && latest.destination.status !== 'active'
        const destinationUnavailable = latest.destination.availability.code === 'destination_unavailable'
        const terminalFailure = item.retry.terminalFailure
        const retryable = item.retry.retryable && retryEntry?.dryRunRequest.canSend === true
        const liveRetryable = item.retry.retryable && retryEntry?.liveRequest.canSend === true
        const delivered = item.status === 'delivered'
        const primaryAction = !timeline.access.canManage
            ? 'review_status'
            : retryable
                ? 'retry_dry_run'
                : liveRetryable
                    ? 'retry_live'
                    : destinationDisabled
                        ? 'enable_destination'
                        : destinationUnavailable
                            ? 'configure_destination'
                            : terminalFailure
                                ? 'rotate_or_disable_destination'
                                : delivered
                                    ? 'monitor'
                                    : 'test_destination'
        const blockers = uniqueRetryQueueBlockers([
            ...item.blockers,
            ...(!timeline.access.canManage ? [retryQueueBlocker('permission_denied', 'Only organization owners and admins can act on webhook deliveries.', latest.destinationId, true)] : []),
        ])
        const dryRunRequest = retryEntry?.dryRunRequest || null
        const liveRequest = retryEntry?.liveRequest || null
        const testDestinationRequest = latest.destinationId
            ? {
                canSend: timeline.access.canManage && !destinationUnavailable,
                noNetwork: true,
                externalSendEnabled: false,
                route: `POST /api/dwm/webhook-destinations/${latest.destinationId}/test`,
                body: {
                    orgId: item.orgId,
                    destinationId: latest.destinationId,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    alertId: item.alertId,
                    dedupeKey: item.dedupeKey,
                    casePath: item.casePath,
                },
                payloadPreview: destinationTestsById.get(latest.destinationId)?.dryRunPayloadPreview || null,
                blockers: blockers.filter(blocker => ['permission_denied', 'destination_unavailable'].includes(blocker.code)),
            }
            : null

        return {
            schemaVersion: 'dwm.webhook.delivery_action.v1',
            action: primaryAction,
            orgId: item.orgId,
            alertId: item.alertId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            requestId: latest.requestId,
            idempotencyKey: latest.idempotencyKey,
            dedupeKey: item.dedupeKey,
            casePath: item.casePath,
            alertUrl: item.alertUrl,
            watchlist: item.watchlist,
            status: item.status,
            destination: latest.destination,
            retry: item.retry,
            audit: {
                latestAuditEventId: item.latestAuditEventId,
                auditEventIds: item.auditEventIds,
                nextAction: primaryAction === 'retry_dry_run' || primaryAction === 'retry_live'
                    ? 'delivery.retry_requested'
                    : primaryAction === 'rotate_or_disable_destination'
                        ? 'destination.update_requested'
                        : primaryAction === 'enable_destination'
                            ? 'destination.enable_requested'
                            : primaryAction === 'test_destination'
                                ? 'delivery.test_requested'
                                : null,
            },
            routes: {
                deliveryList: 'GET /api/dwm/webhook-deliveries',
                retry: 'POST /api/dwm/webhook-deliveries',
                testDestination: latest.destinationId ? `POST /api/dwm/webhook-destinations/${latest.destinationId}/test` : null,
                updateDestination: latest.destinationId ? `PUT /api/dwm/webhook-destinations/${latest.destinationId}` : null,
            },
            operationLinks: latest.operationLinks,
            requests: {
                dryRunRetry: dryRunRequest
                    ? {
                        canSend: dryRunRequest.canSend,
                        noNetwork: true,
                        externalSendEnabled: false,
                        body: dryRunRequest.body,
                        blockers: dryRunRequest.blockers,
                    }
                    : null,
                liveRetry: liveRequest
                    ? {
                        canSend: liveRequest.canSend,
                        noNetwork: false,
                        externalSendEnabled: liveRequest.externalSendEnabled,
                        body: liveRequest.canSend ? liveRequest.body : null,
                        blockers: liveRequest.blockers,
                    }
                    : null,
                testDestination: testDestinationRequest,
            },
            blockers,
            blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
            noNetwork: true,
            externalSendEnabled: liveRequest?.externalSendEnabled === true,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_action_plan.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: actions.some(action => action.externalSendEnabled),
        visibility: timeline.visibility,
        access: timeline.access,
        filters: timeline.filters,
        counts: {
            total: actions.length,
            retryDryRun: actions.filter(action => action.action === 'retry_dry_run').length,
            retryLive: actions.filter(action => action.action === 'retry_live').length,
            rotateOrDisable: actions.filter(action => action.action === 'rotate_or_disable_destination').length,
            enableDestination: actions.filter(action => action.action === 'enable_destination').length,
            monitor: actions.filter(action => action.action === 'monitor').length,
            blocked: actions.filter(action => action.blockingCodes.length > 0).length,
            permissionDenied: timeline.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: timeline.blockers,
        actions,
    }
}

export function buildDwmWebhookDeliveryReplayGuard({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
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
        canReplay: decision.allowed && canManage,
        memberSafe: decision.allowed && !canManage,
    }
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
    }
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                replayKeys: 0,
                dryRunAllowed: 0,
                liveBlocked: 0,
                duplicateDelivered: 0,
                retryable: 0,
                terminalFailure: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook delivery replay guard is not visible for this organization membership.', normalizedFilters.destinationId, true)],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const receiptByIdempotencyKey = new Map<string, typeof receipts.receipts[number]>()
    for (const receipt of receipts.receipts) {
        if (!receipt.idempotencyKey) continue
        const current = receiptByIdempotencyKey.get(receipt.idempotencyKey)
        if (!current || String(receipt.proof.attemptedAt || receipt.proof.createdAt).localeCompare(String(current.proof.attemptedAt || current.proof.createdAt)) > 0) {
            receiptByIdempotencyKey.set(receipt.idempotencyKey, receipt)
        }
    }

    const entries = persistence.deliveryKeys
        .map((key) => {
            const latestReceipt = receiptByIdempotencyKey.get(key.idempotencyKey) || null
            const blockers = []
            if (!access.canReplay) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can replay webhook deliveries.', key.destinationId, true))
            if (key.destination.status && key.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot receive replay deliveries.', key.destinationId, true))
            const alreadyDelivered = key.dedupe.alreadyDelivered || key.status === 'delivered'
            if (alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'A live delivery already exists for this destination and idempotency key.', key.destinationId, true))
            if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and should be remediated before replay.', key.destinationId, true))
            if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; replay proof is dry-run only.', key.destinationId, false))
            if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Replay guard has no linked audit event yet.', key.destinationId, false))
            const uniqueBlockers = uniqueRetryQueueBlockers(blockers)
            const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
            const dryRunAllowed = access.canReplay && !blockingCodes.includes('permission_denied')
            const liveAllowed = dryRunAllowed && liveDeliveryEnabled && !alreadyDelivered && !key.retry.terminalFailure && blockingCodes.length === 0

            return {
                schemaVersion: 'dwm.webhook.delivery_replay_guard_entry.v1',
                idempotencyKey: key.idempotencyKey,
                orgId: key.orgId,
                destinationId: key.destinationId,
                alertId: key.alertId,
                eventType: key.eventType,
                dedupeKey: key.dedupe.latestDedupeKey || key.dedupeKey || dedupeFromIdempotencyKey(key.idempotencyKey) || null,
                watchlistId: key.watchlistId,
                watchlistName: key.watchlistName,
                route: key.route,
                casePath: key.casePath,
                replay: key.replay,
                status: key.status,
                destination: key.destination,
                guard: {
                    dryRunAllowed,
                    liveAllowed,
                    liveBlocked: !liveAllowed,
                    duplicateLiveBlocked: alreadyDelivered,
                    duplicateDryRunAllowed: dryRunAllowed,
                    noNetworkDefault: true,
                    externalSendEnabled: liveAllowed,
                },
                dedupe: key.dedupe,
                retry: key.retry,
                latestAttempt: key.latestAttempt,
                latestReceipt,
                audit: key.audit,
                blockers: uniqueBlockers,
                blockingCodes,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.guard.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            replayKeys: entries.filter(entry => entry.replay || entry.eventType === 'dwm.alert.replayed').length,
            dryRunAllowed: entries.filter(entry => entry.guard.dryRunAllowed).length,
            liveBlocked: entries.filter(entry => entry.guard.liveBlocked).length,
            duplicateDelivered: entries.filter(entry => entry.guard.duplicateLiveBlocked).length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
        },
        blockers: uniqueRetryQueueBlockers(entries.flatMap(entry => entry.blockers)),
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

export function buildDwmWebhookDeliveryRetryRequestContract({
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
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const entries = retryQueue.entries.map((entry) => {
        const dedupeKey = entry.dedupe.latestDedupeKey || dedupeFromIdempotencyKey(entry.idempotencyKey) || entry.alertId
        const requestAlert = {
            id: entry.alertId,
            dedupeKey,
            casePath: entry.casePath,
            watchlist: {
                id: entry.watchlistId,
                name: entry.watchlistName,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.idempotencyKey,
            },
        }
        const baseBody = {
            orgId: entry.orgId,
            organizationId: entry.orgId,
            destinationId: entry.destinationId,
            eventType: entry.eventType,
            alertId: entry.alertId,
            dedupeKey,
            route: entry.route,
            casePath: entry.casePath,
            watchlistItemId: entry.watchlistId,
            watchlistId: entry.watchlistId,
            watchlistName: entry.watchlistName,
            alert: requestAlert,
        }
        const dryRunBlockers = uniqueRetryQueueBlockers(entry.blockers.filter(blocker => blocker.blocking))
        const liveBlockers = uniqueRetryQueueBlockers(
            liveDeliveryEnabled
                ? entry.blockers.filter(blocker => blocker.blocking)
                : [
                    ...entry.blockers,
                    retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; retry request is dry-run only.', entry.destinationId, true),
                ]
        )
        const canDryRun = retryQueue.access.canRetry && entry.retry.dryRunReady
        const canLive = retryQueue.access.canRetry && entry.retry.liveReady

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_request_entry.v1',
            idempotencyKey: entry.idempotencyKey,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alertId,
            eventType: entry.eventType,
            requestId: entry.latestAttempt.requestId,
            deliveryId: entry.latestAttempt.deliveryId,
            casePath: entry.casePath,
            replay: entry.replay,
            status: entry.status,
            destination: entry.destination,
            retry: entry.retry,
            dedupe: entry.dedupe,
            audit: entry.audit,
            blockers: entry.blockers,
            canRetry: canDryRun,
            noNetwork: true,
            externalSendEnabled: canLive,
            routes: {
                dryRun: 'POST /api/dwm/webhook-deliveries',
                live: 'POST /api/dwm/webhook-deliveries',
            },
            dryRunRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRun,
                blockers: canDryRun ? [] : dryRunBlockers,
                body: {
                    ...baseBody,
                    dryRun: true,
                    live: false,
                },
            },
            liveRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: false,
                externalSendEnabled: canLive,
                canSend: canLive,
                blockers: canLive ? [] : liveBlockers,
                body: {
                    ...baseBody,
                    dryRun: false,
                    live: true,
                },
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_request.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: retryQueue.visibility,
        access: retryQueue.access,
        filters: retryQueue.filters,
        routes: {
            retry: 'POST /api/dwm/webhook-deliveries',
            deliveryList: 'GET /api/dwm/webhook-deliveries',
        },
        counts: {
            total: entries.length,
            dryRunReady: entries.filter(entry => entry.dryRunRequest.canSend).length,
            liveReady: entries.filter(entry => entry.liveRequest.canSend).length,
            blocked: entries.filter(entry => !entry.dryRunRequest.canSend).length,
            permissionDenied: retryQueue.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: retryQueue.blockers,
        entries,
    }
}

export function buildDwmWebhookDeliveryRetryWorkOrders({
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
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const workOrders = retryRequest.entries.map((entry) => {
        const blockingCodes = entry.blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const state = entry.liveRequest.canSend
            ? 'live_ready'
            : entry.dryRunRequest.canSend
                ? 'dry_run_ready'
                : entry.dedupe.alreadyDelivered
                    ? 'already_delivered'
                    : entry.retry.terminalFailure
                        ? 'terminal_failure'
                        : blockingCodes.includes('permission_denied')
                            ? 'permission_denied'
                            : 'blocked'
        const nextAuditAction = state === 'dry_run_ready' || state === 'live_ready'
            ? 'delivery.retry_requested'
            : state === 'already_delivered'
                ? 'delivery.retry_skipped_duplicate'
                : state === 'terminal_failure'
                    ? 'delivery.retry_terminal_failure'
                    : 'delivery.retry_blocked'

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_work_order.v1',
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alertId,
            eventType: entry.eventType,
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            idempotencyKey: entry.idempotencyKey,
            dedupeKey: entry.dedupe.latestDedupeKey || dedupeFromIdempotencyKey(entry.idempotencyKey) || null,
            casePath: entry.casePath,
            replay: entry.replay,
            state,
            destination: entry.destination,
            eligibility: {
                canRetry: entry.canRetry,
                dryRunReady: entry.dryRunRequest.canSend,
                liveReady: entry.liveRequest.canSend,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.persistedAttemptCount,
                terminalFailure: entry.retry.terminalFailure,
                lastErrorCategory: entry.retry.lastErrorCategory,
                blockers: entry.blockers,
            },
            request: {
                route: entry.routes.dryRun,
                dryRunBody: entry.dryRunRequest.body,
                liveBody: entry.liveRequest.canSend ? entry.liveRequest.body : null,
                noNetwork: true,
                externalSendEnabled: entry.liveRequest.canSend,
            },
            audit: {
                latestAuditEventId: entry.audit.latestAuditEventId,
                auditEventIds: entry.audit.auditEventIds,
                nextAction: nextAuditAction,
                requiredMetadata: [
                    'orgId',
                    'destinationId',
                    'deliveryId',
                    'idempotencyKey',
                    'dedupeKey',
                    'status',
                    'dryRun',
                    'live',
                ],
            },
            worker3Proof: {
                route: 'POST /api/dwm/webhook-deliveries',
                expectedDryRunStatus: entry.dryRunRequest.canSend ? 'dry_run' : 'blocked',
                expectedLiveStatus: entry.liveRequest.canSend ? 'delivered_or_failed' : 'blocked',
                noNetworkDefault: true,
                liveRequiresConfig: !liveDeliveryEnabled,
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_work_orders.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: workOrders.some(order => order.request.externalSendEnabled),
        visibility: retryRequest.visibility,
        access: retryRequest.access,
        filters: retryRequest.filters,
        counts: {
            total: workOrders.length,
            dryRunReady: workOrders.filter(order => order.state === 'dry_run_ready').length,
            liveReady: workOrders.filter(order => order.state === 'live_ready').length,
            blocked: workOrders.filter(order => order.state === 'blocked' || order.state === 'permission_denied').length,
            alreadyDelivered: workOrders.filter(order => order.state === 'already_delivered').length,
            terminalFailure: workOrders.filter(order => order.state === 'terminal_failure').length,
            auditLinked: workOrders.filter(order => Boolean(order.audit.latestAuditEventId)).length,
        },
        blockers: retryRequest.blockers,
        workOrders,
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
                delete: `DELETE /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}`,
                archive: `DELETE /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}`,
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
                        updatedAt: delivery.updatedAt || delivery.createdAt,
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

export function buildDwmWebhookDeliveryAuditTrail({
    auditEvents,
    deliveries = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    auditEvents: DwmWebhookAuditPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    destinations?: DwmWebhookDestinationPublic[]
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
        memberSafe: decision.allowed && !canManage,
    }
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
    }
    const deniedBlocker = auditTrailBlocker('permission_denied', 'Webhook delivery audit trail is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.audit_trail.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                destination: 0,
                delivery: 0,
                failed: 0,
                retryable: 0,
                replay: 0,
                memberSafe: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const retryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
        auditEvents,
        deliveries,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const retryByDeliveryId = new Map(retryWorkOrders.workOrders.map(order => [order.deliveryId, order]))
    const entries = auditContracts
        .filter((audit) => {
            if (normalizedFilters.orgId && audit.orgId !== normalizedFilters.orgId) return false
            if (normalizedFilters.destinationId && audit.destinationId !== normalizedFilters.destinationId) return false
            if (normalizedFilters.requestId && audit.deliveryId !== normalizedFilters.requestId && audit.requestId !== normalizedFilters.requestId) return false
            if (normalizedFilters.alertId && audit.delivery?.alertId !== normalizedFilters.alertId) return false
            if (normalizedFilters.casePath && audit.delivery?.casePath !== normalizedFilters.casePath) return false
            if (normalizedFilters.dedupeKey) {
                const deliveryDedupeKey = audit.delivery?.idempotencyKey
                    ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey)
                    : null
                if (audit.delivery?.idempotencyKey !== normalizedFilters.dedupeKey && deliveryDedupeKey !== normalizedFilters.dedupeKey) return false
            }
            return true
        })
        .map((audit) => {
            const retryWorkOrder = audit.deliveryId ? retryByDeliveryId.get(audit.deliveryId) || null : null
            const replay = audit.delivery?.eventType === 'dwm.alert.replayed' || audit.action === 'delivery.replayed'
            const summary = audit.category === 'destination'
                ? `${audit.outcome} destination ${audit.destination?.label || audit.destinationId || 'webhook destination'}`
                : `${audit.outcome} ${audit.delivery?.eventType || 'webhook delivery'} for alert ${audit.delivery?.alertId || 'unknown'}`
            const retryActionRequest = retryWorkOrder
                ? {
                    action: retryWorkOrder.state === 'dry_run_ready' || retryWorkOrder.state === 'live_ready'
                        ? 'retry_delivery'
                        : retryWorkOrder.state === 'already_delivered'
                            ? 'review_duplicate'
                            : retryWorkOrder.state === 'terminal_failure'
                                ? 'remediate_destination'
                                : 'review_blocker',
                    method: 'POST',
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: access.canManage && retryWorkOrder.eligibility.dryRunReady,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && retryWorkOrder.eligibility.dryRunReady
                        ? retryWorkOrder.request.dryRunBody
                        : null,
                    expectedAuditAction: retryWorkOrder.audit.nextAction,
                    expectedStatus: retryWorkOrder.eligibility.dryRunReady ? 'dry_run' : 'blocked',
                    blockers: retryWorkOrder.eligibility.blockers,
                }
                : null
            const destinationTestRequest = !retryActionRequest && audit.destinationId
                ? {
                    action: 'test_destination',
                    method: 'POST',
                    route: `POST /api/dwm/webhook-destinations/${audit.destinationId}/test`,
                    canSend: access.canManage && audit.destination?.enabled === true,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && audit.destination?.enabled === true
                        ? {
                            orgId: audit.orgId,
                            destinationId: audit.destinationId,
                            eventType: 'dwm.alert.test' as DwmAlertEventType,
                            dryRun: true,
                            live: false,
                            idempotencyKey: buildIdempotencyKey('dwm.alert.test', audit.orgId, audit.destinationId, 'webhook_test'),
                        }
                        : null,
                    expectedAuditAction: 'delivery.tested',
                    expectedStatus: access.canManage && audit.destination?.enabled === true ? 'dry_run' : 'blocked',
                    blockers: audit.destination?.enabled === true
                        ? []
                        : [auditTrailBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', audit.destinationId, true)],
                }
                : null

            return {
                schemaVersion: 'dwm.webhook.audit_trail_entry.v1',
                auditEventId: audit.auditEventId,
                action: audit.action,
                category: audit.category,
                outcome: audit.outcome,
                severity: audit.severity,
                orgId: audit.orgId,
                destinationId: audit.destinationId,
                deliveryId: audit.deliveryId,
                requestId: audit.requestId,
                actorId: access.canManage ? audit.actorId : null,
                customerSummary: truncate(summary, 180),
                destination: audit.destination,
                delivery: audit.delivery
                    ? {
                        alertId: audit.delivery.alertId,
                        eventType: audit.delivery.eventType,
                        status: audit.delivery.status,
                        dryRun: audit.delivery.dryRun,
                        live: audit.delivery.live,
                        replay,
                        idempotencyKey: audit.delivery.idempotencyKey,
                        dedupeKey: audit.delivery.idempotencyKey ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey) : null,
                        payloadHash: audit.delivery.payloadHash,
                        responseStatus: audit.delivery.responseStatus,
                        error: audit.delivery.error,
                        watchlistId: audit.delivery.watchlistId,
                        watchlistName: audit.delivery.watchlistName,
                        route: audit.delivery.route,
                        casePath: audit.delivery.casePath,
                        attemptedAt: audit.delivery.attemptedAt,
                        updatedAt: audit.delivery.updatedAt,
                    }
                    : null,
                retry: retryWorkOrder
                    ? {
                        state: retryWorkOrder.state,
                        nextRetryAt: retryWorkOrder.eligibility.nextRetryAt,
                        attemptCount: retryWorkOrder.eligibility.attemptCount,
                        lastErrorCategory: retryWorkOrder.eligibility.lastErrorCategory,
                        canRetry: access.canManage && retryWorkOrder.eligibility.canRetry,
                        nextAuditAction: retryWorkOrder.audit.nextAction,
                    }
                    : audit.retry,
                metadata: access.canManage ? audit.metadata : null,
                actionRequest: retryActionRequest || destinationTestRequest,
                routes: {
                    delivery: audit.deliveryId ? `GET /api/dwm/webhook-deliveries?deliveryId=${audit.deliveryId}` : null,
                    destination: audit.destinationId ? `GET /api/dwm/webhooks?destinationId=${audit.destinationId}` : null,
                    retry: retryWorkOrder ? 'POST /api/dwm/webhook-deliveries' : null,
                    testDestination: audit.destinationId ? `POST /api/dwm/webhook-destinations/${audit.destinationId}/test` : null,
                },
                memberSafe: access.memberSafe,
                createdAt: audit.createdAt,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.audit_trail.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        visibility: decision,
        access,
        filters: normalizedFilters,
        counts: {
            total: entries.length,
            destination: entries.filter(entry => entry.category === 'destination').length,
            delivery: entries.filter(entry => entry.category === 'delivery').length,
            failed: entries.filter(entry => entry.outcome === 'failed').length,
            retryable: entries.filter(entry => Boolean(entry.retry?.nextRetryAt)).length,
            replay: entries.filter(entry => entry.delivery?.replay).length,
            memberSafe: entries.filter(entry => entry.memberSafe).length,
        },
        blockers: [],
        entries,
    }
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
            display: {
                label: destination.name,
                channelLabel: destination.kind === 'discord' ? destination.name : null,
                destinationType: destination.kind,
                enabled: destination.status === 'active',
                status: destination.status,
            },
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

export function buildDwmWebhookCustomerSetupProof({
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
        canCreate: decision.allowed && canManage,
        canUpdate: decision.allowed && canManage,
        canTest: decision.allowed && canManage,
        canDelete: decision.allowed && canManage,
        canDeliver: decision.allowed && canManage,
        memberSafe: decision.allowed && !canManage,
    }
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.customer_setup.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            status: 'permission_denied',
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                verifiedDryRunCount: 0,
                recentOrgAlertDeliveryCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook destination setup is not visible for this organization membership.', null, true)],
            routes: webhookSetupRoutes(),
            setupSteps: [],
        }
    }

    const readiness = buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const destinationTests = destinations.map(destination => buildDwmWebhookDestinationTestContract({
        destination,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    }))
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const activeDestinations = readiness.destinations.filter(destination => destination.enabled)
    const verifiedTests = destinationTests.filter(test => test.status === 'verified')
    const recentOrgAlertDeliveries = readiness.recentAttempts.filter(attempt => attempt.eventType !== 'dwm.alert.test')
    const retryScheduled = readiness.destinations.filter(destination => destination.retryState.retryable)
    const terminalFailures = replayGuard.entries.filter(entry => entry.retry.terminalFailure)
    const firstActiveDestination = activeDestinations[0] || null
    const dryRunTestRequests = activeDestinations.map(destination => {
        const test = destinationTests.find(item => item.destinationId === destination.destinationId) || null
        return {
            method: 'POST',
            route: `POST /api/dwm/webhook-destinations/${destination.destinationId}/test`,
            noNetwork: true,
            externalSendEnabled: false,
            destinationId: destination.destinationId,
            orgId: destination.orgId,
            label: destination.label,
            enabled: destination.enabled,
            status: destination.status,
            body: {
                dryRun: true,
                live: false,
                eventType: 'dwm.alert.test',
                destinationId: destination.destinationId,
                orgId: destination.orgId,
            },
            payloadPreview: test?.dryRunPayloadPreview || null,
            blockers: test?.blockers || [],
        }
    })
    const blockers = []
    if (destinations.length === 0) blockers.push(retryQueueBlocker('missing_webhook_destination', 'Create a Discord or webhook destination before enabling customer alert delivery.', null, true))
    if (destinations.length > 0 && activeDestinations.length === 0) blockers.push(retryQueueBlocker('no_active_destination', 'All webhook destinations are disabled.', null, true))
    if (activeDestinations.length > 0 && verifiedTests.length === 0) blockers.push(retryQueueBlocker('no_verified_dry_run', 'Run a dry-run destination test before relying on customer notifications.', firstActiveDestination?.destinationId || null, true))
    if (recentOrgAlertDeliveries.length === 0) blockers.push(retryQueueBlocker('no_recent_org_alert_delivery', 'No org alert delivery attempt has been recorded yet.', firstActiveDestination?.destinationId || null, false))
    if (retryScheduled.length > 0) blockers.push(retryQueueBlocker('retry_scheduled', 'One or more destinations have retryable failed deliveries.', retryScheduled[0]?.destinationId || null, false))
    if (terminalFailures.length > 0) blockers.push(retryQueueBlocker('terminal_failure', 'One or more destinations have terminal delivery failures that need remediation.', terminalFailures[0]?.destinationId || null, true))
    if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled; setup can still be verified with dry-run tests.', firstActiveDestination?.destinationId || null, false))
    const uniqueBlockers = uniqueRetryQueueBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const status = blockingCodes.length > 0
        ? destinations.length === 0
            ? 'missing_destination'
            : 'blocked'
        : verifiedTests.length > 0
            ? 'verified'
            : 'needs_test'

    return {
        schemaVersion: 'dwm.webhook.customer_setup.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
        visibility: decision,
        access,
        status,
        summary: {
            destinationCount: destinations.length,
            activeDestinationCount: activeDestinations.length,
            verifiedDryRunCount: verifiedTests.length,
            recentOrgAlertDeliveryCount: recentOrgAlertDeliveries.length,
            retryScheduledCount: retryScheduled.length,
            terminalFailureCount: terminalFailures.length,
        },
        routes: webhookSetupRoutes(firstActiveDestination?.destinationId || '<destination_id>'),
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        setupSteps: [
            {
                id: 'create_destination',
                label: 'Create destination',
                status: destinations.length > 0 ? 'complete' : access.canCreate ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhooks',
                blockers: destinations.length > 0 ? [] : uniqueBlockers.filter(blocker => blocker.code === 'permission_denied'),
            },
            {
                id: 'dry_run_test',
                label: 'Run dry-run test',
                status: verifiedTests.length > 0 ? 'complete' : activeDestinations.length > 0 && access.canTest ? 'available' : 'blocked',
                route: firstActiveDestination ? `POST /api/dwm/webhook-destinations/${firstActiveDestination.destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test',
                noNetwork: true,
                externalSendEnabled: false,
                blockers: uniqueBlockers.filter(blocker => ['no_active_destination', 'missing_webhook_destination', 'permission_denied'].includes(blocker.code)),
            },
            {
                id: 'deliver_org_alert',
                label: 'Deliver org alert',
                status: recentOrgAlertDeliveries.length > 0 ? 'complete' : blockingCodes.length === 0 && access.canDeliver ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
                blockers: uniqueBlockers,
            },
        ],
        dryRunTestRequest: dryRunTestRequests[0] || null,
        dryRunTestRequests,
        deliveryReadiness: readiness,
        destinationTests,
        destinationAdminProof: adminProof,
        deliveryReplayGuard: replayGuard,
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
    const operationStatus = action === 'delete' ? 'archived' : action === 'disable' ? 'paused' : null
    const status = parseStatus(input.status ?? operationStatus ?? destination?.status ?? 'active')
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
    if (destination && normalizedOrgId !== destination.orgId) {
        blockers.push(crudBlocker('org_scope_mismatch', 'Webhook destinations cannot be moved between organizations. Create a new destination for the target organization.', destination.id))
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
    if ((action === 'update' || action === 'disable' || action === 'delete' || action === 'enable' || action === 'test') && !destination) {
        blockers.push(crudBlocker('permission_denied', 'Webhook destination is not available for this organization.', null))
    }
    if ((action === 'disable' || action === 'delete' || action === 'test') && destination?.status !== 'active') {
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
            canDelete: canManage && destination?.status === 'active',
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
    const deliveryOutcome = buildDwmOrgAlertWebhookDeliveryOutcome({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
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
    const deliveryTimeline = buildDwmWebhookDeliveryTimeline({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        filters: {
            orgId: dispatch.orgId,
            destinationId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey,
        },
    })
    const deliveryActionPlan = buildDwmWebhookDeliveryActionPlan({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        filters: {
            orgId: dispatch.orgId,
            destinationId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey,
        },
    })
    const deliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        filters: {
            orgId: dispatch.orgId,
            destinationId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey,
        },
    })
    const customerSetup = buildDwmWebhookCustomerSetupProof({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const alertDeliveryProof = buildDwmWebhookAlertDeliveryProof({
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        selectedDestinations: dispatch.selectedDestinations,
        skippedDestinations: dispatch.skippedDestinations,
        normalizedAlert,
        watchlist,
        customerSetup,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        destinationAdminProof,
        auditEventContracts,
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
        customerSetup,
        alertDestinationReadiness,
        alertDeliveryProof,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        auditEventContracts,
    }
}

function buildDwmWebhookAlertDeliveryProof({
    ownerId,
    orgId,
    eventType,
    dryRun,
    liveRequested,
    liveDeliveryEnabled,
    selectedDestinations,
    skippedDestinations,
    normalizedAlert,
    watchlist,
    customerSetup,
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryTimeline,
    deliveryActionPlan,
    deliveryReplayGuard,
    destinationAdminProof,
    auditEventContracts,
}: {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    dryRun: boolean
    liveRequested: boolean
    liveDeliveryEnabled: boolean
    selectedDestinations: DwmAlertWebhookDispatchPlan['selectedDestinations']
    skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations']
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    customerSetup: ReturnType<typeof buildDwmWebhookCustomerSetupProof>
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryTimeline: ReturnType<typeof buildDwmWebhookDeliveryTimeline>
    deliveryActionPlan: ReturnType<typeof buildDwmWebhookDeliveryActionPlan>
    deliveryReplayGuard: ReturnType<typeof buildDwmWebhookDeliveryReplayGuard>
    destinationAdminProof: ReturnType<typeof buildDwmWebhookDestinationAdminProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const setupBlockers = [
        ...customerSetup.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...destinationAdminProof.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, true)),
    ]
    const deliveryBlockers = [
        ...alertDestinationReadiness.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryOutcome.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryTimeline.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryActionPlan.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryReplayGuard.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
    ]
    const selectedDestinationIds = new Set(selectedDestinations.map(destination => destination.id))
    const alertScopedBlockers = uniqueAlertDeliveryProofBlockers(deliveryBlockers.filter((blocker) => {
        if (!blocker.destinationId) return true
        if (selectedDestinationIds.size === 0) return true
        return selectedDestinationIds.has(blocker.destinationId)
    }))
    const blockers = uniqueAlertDeliveryProofBlockers([...setupBlockers, ...deliveryBlockers])
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const setupBlockingCodes = uniqueAlertDeliveryProofBlockers(setupBlockers)
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const alertScopedBlockingCodes = alertScopedBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const auditEventIds = [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))]
    const recordedDeliveryCount = deliveryOutcome.counts.recorded
    const recordedDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .map(destination => destination.destinationId)
    const pendingDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => !destination.recorded)
        .map(destination => destination.destinationId)
    const recordedDestinationBlockers = uniqueAlertDeliveryProofBlockers(deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .flatMap(destination => destination.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking))))
    const recordedDeliveryBlockingCodes = recordedDestinationBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const safeAlertBody = {
        id: normalizedAlert.id,
        title: normalizedAlert.title,
        severity: normalizedAlert.severity,
        confidence: normalizedAlert.confidence,
        sourceFamily: normalizedAlert.sourceFamily,
        evidenceCount: normalizedAlert.evidenceCount,
        route: normalizedAlert.route,
        dedupeKey: normalizedAlert.dedupeKey,
        casePath: normalizedAlert.casePath,
        caseId: normalizedAlert.caseId,
        alertUrl: normalizedAlert.alertUrl,
        provenanceSummary: normalizedAlert.provenanceSummary,
        watchlist,
    }
    const deliveryRequestBodyForDestination = (destinationId: string, live: boolean) => ({
        orgId,
        organizationId: orgId,
        tenantId: orgId,
        destinationId,
        eventType,
        alertId: normalizedAlert.id,
        watchlistItemId: watchlist.id,
        watchlistName: watchlist.name,
        dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        route: normalizedAlert.route,
        casePath: normalizedAlert.casePath,
        evidenceCount: normalizedAlert.evidenceCount,
        sourceFamily: normalizedAlert.sourceFamily,
        dryRun: !live,
        live,
        alert: safeAlertBody,
    })
    const dryRunDeliveryRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
        expectedAuditAction: deliveryAuditActionForEvent(eventType),
        method: 'POST',
        route: 'POST /api/dwm/webhook-deliveries',
        noNetwork: true,
        externalSendEnabled: false,
        body: deliveryRequestBodyForDestination(destination.id, false),
        blockers: alertScopedBlockers.filter(blocker => blocker.destinationId === destination.id),
    }))
    const liveDeliveryRequests = selectedDestinations.map(destination => {
        const destinationBlockers = alertScopedBlockers.filter(blocker => !blocker.destinationId || blocker.destinationId === destination.id)
        const blockingDestinationCodes = destinationBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const canSend = liveDeliveryEnabled && !dryRun && liveRequested && blockingDestinationCodes.length === 0
        return {
            destinationId: destination.id,
            expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            expectedAuditAction: deliveryAuditActionForEvent(eventType),
            method: 'POST',
            route: 'POST /api/dwm/webhook-deliveries',
            noNetwork: !canSend,
            externalSendEnabled: canSend,
            body: canSend ? deliveryRequestBodyForDestination(destination.id, true) : null,
            blockers: destinationBlockers,
        }
    })
    const customerSetupDryRunRequests = Array.isArray((customerSetup as { dryRunTestRequests?: unknown }).dryRunTestRequests)
        ? (customerSetup as { dryRunTestRequests: Array<{ destinationId?: string, payloadPreview?: unknown }> }).dryRunTestRequests
        : []
    const customerSetupDryRunRequestByDestination = new Map(customerSetupDryRunRequests
        .map(request => [clean(request.destinationId), request] as const)
        .filter(([destinationId]) => Boolean(destinationId)))
    const destinationTestRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey('dwm.alert.test', orgId, destination.id, 'webhook_test'),
        expectedAuditAction: 'delivery.tested',
        method: 'POST',
        route: `POST /api/dwm/webhook-destinations/${destination.id}/test`,
        noNetwork: true,
        externalSendEnabled: false,
        body: {
            orgId,
            destinationId: destination.id,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            dryRun: true,
            live: false,
            alert: safeAlertBody,
        },
        payloadPreview: customerSetupDryRunRequestByDestination.get(destination.id)?.payloadPreview || null,
    }))
    const status = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : blockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'
    const alertScopedStatus = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : alertScopedBlockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'

    return {
        schemaVersion: 'dwm.webhook.alert_delivery_proof.v1',
        ownerId,
        orgId: orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        status,
        alertScopedStatus,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
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
            selectedCount: selectedDestinations.length,
            skippedCount: skippedDestinations.length,
            selectedDestinationIds: [...selectedDestinationIds],
            skippedDestinations: skippedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.orgId,
                reason: destination.reason,
                blocking: destination.reason !== 'event_not_subscribed',
            })),
        },
        setup: {
            status: customerSetup.status,
            summary: customerSetup.summary,
            routeNames: customerSetup.routes,
            stepStatuses: customerSetup.setupSteps.map(step => ({
                id: step.id,
                status: step.status,
                route: step.route,
                blockerCodes: step.blockers.map(blocker => blocker.code),
            })),
        },
        delivery: {
            ready: alertDestinationReadiness.ready,
            state: alertDestinationReadiness.state,
            outcomeCounts: deliveryOutcome.counts,
            timelineCounts: deliveryTimeline.counts,
            actionCounts: deliveryActionPlan.counts,
            replayGuardCounts: deliveryReplayGuard.counts,
            latestAuditEventIds: auditEventIds.slice(0, 10),
            recordedDestinationIds,
            pendingDestinationIds,
            recordedDeliveryStatus: recordedDeliveryCount === 0
                ? 'not_recorded'
                : recordedDeliveryBlockingCodes.length > 0
                    ? 'blocked'
                    : 'recorded',
            recordedDeliveryBlockerCodes: recordedDeliveryBlockingCodes,
        },
        retryAndReplay: {
            retryScheduledCount: deliveryActionPlan.counts.retryDryRun + deliveryActionPlan.counts.retryLive,
            replayReadyCount: deliveryReplayGuard.counts.dryRunAllowed,
            duplicateDeliveredCount: deliveryReplayGuard.counts.duplicateDelivered,
            terminalFailureCount: deliveryReplayGuard.counts.terminalFailure,
        },
        dashboardProof: {
            productProgress: destinationAdminProof.productProgress,
            adminProofSummary: destinationAdminProof.summary,
            customerSetupRoute: customerSetup.routes.list,
            deliveryRoute: customerSetup.routes.deliver,
            deliveryHistoryRoute: customerSetup.routes.deliveryHistory,
        },
        actionRequests: {
            dryRunDeliveries: dryRunDeliveryRequests,
            liveDeliveries: liveDeliveryRequests,
            destinationTests: destinationTestRequests,
            deliveryHistory: {
                method: 'GET',
                route: customerSetup.routes.deliveryHistory,
                expectedAuditActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
                query: {
                    orgId,
                    alertId: normalizedAlert.id,
                    dedupeKey: normalizedAlert.dedupeKey,
                    casePath: normalizedAlert.casePath,
                },
            },
        },
        blockers,
        blockerCodes: blockingCodes,
        alertScopedBlockers,
        alertScopedBlockerCodes: alertScopedBlockingCodes,
        blockerGroups: {
            setupBlockerCodes: setupBlockingCodes,
            alertScopedBlockerCodes: alertScopedBlockingCodes,
            allBlockerCodes: blockingCodes,
        },
    }
}

export function buildDwmOrgAlertWebhookDeliveryOutcome({
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
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const auditByDeliveryId = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))

    const selectedDestinations = dispatch.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
        const relatedAttempts = ledger
            .filter(attempt => attempt.idempotencyKey === idempotencyKey)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = relatedAttempts[0] || null
        const delivery = latestAttempt ? deliveryById.get(latestAttempt.deliveryId) || null : null
        const preview = delivery ? buildDwmWebhookDeliveryPreview(delivery) : null
        const audit = latestAttempt ? auditByDeliveryId.get(latestAttempt.deliveryId) || null : null
        const health = healthByDestination.get(destination.id) || null
        const blockers: ReturnType<typeof orgAlertOutcomeBlocker>[] = []
        if (!latestAttempt) blockers.push(orgAlertOutcomeBlocker('not_recorded', 'No delivery attempt has been recorded for this selected destination yet.', destination.id, true))
        if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(orgAlertOutcomeBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', destination.id, true))
        if (latestAttempt?.retryable) blockers.push(orgAlertOutcomeBlocker('retry_scheduled', 'Latest delivery attempt is retryable and has backoff scheduled.', destination.id, false))
        if (latestAttempt?.status === 'skipped') blockers.push(orgAlertOutcomeBlocker('delivery_skipped', 'Latest delivery attempt was skipped.', destination.id, latestAttempt.errorClass !== 'live_delivery_disabled'))
        if (health && !health.ready && health.blockers.some(blocker => blocker !== 'live_delivery_disabled' && blocker !== 'retry_scheduled')) {
            blockers.push(orgAlertOutcomeBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }

        return {
            schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_destination.v1',
            destinationId: destination.id,
            orgId: destination.org_id,
            label: destination.name,
            type: destination.kind,
            status: latestAttempt?.status || 'not_recorded',
            idempotencyKey,
            recorded: Boolean(latestAttempt),
            latestAttempt: latestAttempt
                ? {
                    requestId: latestAttempt.requestId,
                    deliveryId: latestAttempt.deliveryId,
                    status: latestAttempt.status,
                    rawStatus: latestAttempt.rawStatus,
                    dryRun: latestAttempt.dryRun,
                    live: latestAttempt.live,
                    liveRequested: latestAttempt.liveRequested,
                    responseStatus: latestAttempt.responseStatus,
                    errorClass: latestAttempt.errorClass,
                    retryable: latestAttempt.retryable,
                    nextRetryAt: latestAttempt.nextRetryAt,
                    attemptCount: latestAttempt.attemptCount,
                    auditEventId: audit?.auditEventId || latestAttempt.auditEventId,
                    attemptedAt: latestAttempt.attemptedAt,
                    payloadHash: latestAttempt.payloadHash,
                }
                : null,
            preview: preview
                ? {
                    discord: {
                        content: preview.discord.content,
                        embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                        fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                            ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                            : [],
                    },
                    context: preview.context,
                    payloadHash: preview.payloadHash,
                }
                : null,
            audit: {
                latestAuditEventId: audit?.auditEventId || latestAttempt?.auditEventId || null,
                action: audit?.action || latestAttempt?.auditAction || null,
            },
            operationLinks: preview?.operationLinks || null,
            health: health
                ? {
                    status: health.health,
                    ready: health.ready,
                    blockers: health.blockers,
                    latestAuditEventId: health.latestAuditEventId,
                }
                : null,
            blockers: uniqueOrgAlertOutcomeBlockers(blockers),
        }
    })
    const skippedDestinations = dispatch.skippedDestinations.map(skipped => ({
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_skipped_destination.v1',
        destinationId: skipped.id,
        orgId: skipped.orgId,
        status: 'skipped',
        reason: skipped.reason,
        blockers: [orgAlertOutcomeBlocker(skipped.reason, `Destination skipped: ${skipped.reason}.`, skipped.id, skipped.reason !== 'event_not_subscribed')],
    }))
    const allBlockers = uniqueOrgAlertOutcomeBlockers([
        ...selectedDestinations.flatMap(destination => destination.blockers),
        ...skippedDestinations.flatMap(destination => destination.blockers),
    ])

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        counts: {
            selected: selectedDestinations.length,
            skipped: skippedDestinations.length,
            recorded: selectedDestinations.filter(destination => destination.recorded).length,
            dryRun: selectedDestinations.filter(destination => destination.latestAttempt?.dryRun).length,
            delivered: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'sent').length,
            failed: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'failed').length,
            retryable: selectedDestinations.filter(destination => destination.latestAttempt?.retryable).length,
            blocked: allBlockers.filter(blocker => blocker.blocking).length,
        },
        selectedDestinations,
        skippedDestinations,
        blockers: allBlockers,
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
    const retryPlan = planDwmWebhookDeliveryRetry({
        status: delivery.status,
        dryRun: delivery.dryRun,
        responseStatus: delivery.responseStatus,
        error: delivery.error,
        attemptedAt: delivery.attemptedAt,
        attemptCount: delivery.attemptCount || 1,
    })

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
        sanitizedPayloadPreview: buildSanitizedDwmWebhookPayloadPreview(delivery, context, embeds),
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
        operationLinks: buildDwmWebhookDeliveryOperationLinks(delivery),
        response: {
            httpStatus: delivery.responseStatus,
            summary: delivery.responseBody ? redactDeliveryEvidenceText(truncate(delivery.responseBody, 500)) : null,
        },
        error: delivery.error ? redactDeliveryEvidenceText(truncate(delivery.error, 500)) : null,
        retry: {
            retryable: Boolean(delivery.nextRetryAt) || retryPlan.retryable,
            nextRetryAt: delivery.nextRetryAt || retryPlan.nextRetryAt,
            errorClass: delivery.errorClass || retryPlan.errorClass,
            attemptCount: delivery.attemptCount || 1,
            reason: retryPlan.reason,
            persisted: Boolean(delivery.errorClass || delivery.attemptCount || delivery.nextRetryAt),
        },
        audit: {
            auditEventId: null,
            expectedAction: deliveryAuditActionForEvent(delivery.eventType),
        },
        payloadHash: delivery.payloadHash,
        idempotencyKey: delivery.idempotencyKey,
        timestamps: {
            attemptedAt: delivery.attemptedAt,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt || delivery.createdAt,
        },
    }
}

function buildSanitizedDwmWebhookPayloadPreview(
    delivery: DwmWebhookDeliveryPublic,
    context: Record<string, unknown>,
    embeds: unknown
) {
    const payload = recordOrEmpty(delivery.payload)
    const alert = recordOrEmpty(context.alert)
    const watchlist = recordOrEmpty(context.watchlist)
    const deliveryContext = recordOrEmpty(context.delivery)
    const org = recordOrEmpty(context.org)
    const firstEmbed = Array.isArray(embeds) ? recordOrEmpty(embeds[0]) : {}
    const fields = Array.isArray(firstEmbed.fields) ? firstEmbed.fields.map(recordOrEmpty) : []
    const content = redactDeliveryEvidenceText(truncate(clean(payload.content), DISCORD_CONTENT_LIMIT))
    const description = redactDeliveryEvidenceText(truncate(clean(firstEmbed.description), DISCORD_EMBED_DESCRIPTION_LIMIT))
    const fieldSummaries = fields.slice(0, 16).map(field => ({
        name: truncate(redactDeliveryEvidenceText(clean(field.name) || 'Field'), 80),
        valuePreview: truncate(redactDeliveryEvidenceText(clean(field.value)), 180),
        inline: field.inline === true,
    }))
    const linkCandidates = [
        clean(deliveryContext.alertUrl),
        clean(alert.alertUrl),
        clean(deliveryContext.casePath),
        clean(alert.casePath),
        delivery.casePath,
    ].filter((link): link is string => Boolean(link))

    return {
        schemaVersion: 'dwm.webhook.sanitized_payload_preview.v1',
        requestId: delivery.id,
        payloadHash: delivery.payloadHash,
        idempotencyKey: delivery.idempotencyKey,
        status: delivery.status,
        dryRun: delivery.dryRun,
        live: !delivery.dryRun && delivery.status !== 'skipped',
        eventType: delivery.eventType,
        title: redactDeliveryEvidenceText(truncate(clean(firstEmbed.title) || clean(alert.title) || delivery.alertId, DISCORD_EMBED_TITLE_LIMIT)),
        contentPreview: content || null,
        descriptionPreview: description || null,
        fieldNames: fieldSummaries.map(field => field.name),
        fields: fieldSummaries,
        context: {
            orgId: clean(org.id) || delivery.orgId,
            orgName: redactDeliveryEvidenceText(truncate(clean(org.name) || delivery.orgId, 120)),
            alertId: clean(alert.id) || delivery.alertId,
            alertTitle: redactDeliveryEvidenceText(truncate(clean(alert.title), 160)),
            severity: clean(alert.severity),
            sourceFamily: clean(alert.sourceFamily),
            eventTimestamp: clean(alert.eventTimestamp) || clean(deliveryContext.eventTimestamp) || clean(context.occurredAt),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id) || delivery.watchlistId,
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name) || delivery.watchlistName || '', 120)) || null,
            route: clean(deliveryContext.route) || delivery.route,
            casePath: clean(deliveryContext.casePath) || clean(alert.casePath) || delivery.casePath,
            alertUrl: clean(deliveryContext.alertUrl) || clean(alert.alertUrl),
            dedupeKey: clean(deliveryContext.dedupeKey) || clean(alert.dedupeKey) || dedupeFromIdempotencyKey(delivery.idempotencyKey),
            replay: delivery.eventType === 'dwm.alert.replayed' || deliveryContext.replay === true,
        },
        links: [...new Set(linkCandidates)].map(link => redactDeliveryEvidenceText(truncate(link, 300))),
        redaction: {
            endpointExposed: false,
            secretFields: [],
            safeForCustomerDisplay: true,
        },
    }
}

function buildDwmWebhookDestinationTestPayloadPreview(payload: unknown) {
    const record = recordOrEmpty(payload)
    const context = recordOrEmpty(record._hanasand)
    const alert = recordOrEmpty(context.alert)
    const watchlist = recordOrEmpty(context.watchlist)
    const delivery = recordOrEmpty(context.delivery)
    const org = recordOrEmpty(context.org)
    const source = recordOrEmpty(context.source)
    const embeds = Array.isArray(record.embeds) ? record.embeds.map(recordOrEmpty).slice(0, 1) : []
    const firstEmbed = embeds[0] || {}
    const fields = Array.isArray(firstEmbed.fields) ? firstEmbed.fields.map(recordOrEmpty).slice(0, DISCORD_EMBED_FIELD_LIMIT) : []

    return {
        schemaVersion: 'dwm.webhook.destination_test_payload_preview.v1',
        noNetwork: true,
        eventType: 'dwm.alert.test' as DwmAlertEventType,
        payloadType: Array.isArray(record.embeds) ? 'discord' : 'webhook',
        discord: {
            content: redactDeliveryEvidenceText(truncate(clean(record.content), DISCORD_CONTENT_LIMIT)) || null,
            allowedMentions: record.allowed_mentions || null,
            embedCount: embeds.length,
            title: redactDeliveryEvidenceText(truncate(clean(firstEmbed.title), DISCORD_EMBED_TITLE_LIMIT)) || null,
            description: redactDeliveryEvidenceText(truncate(clean(firstEmbed.description), DISCORD_EMBED_DESCRIPTION_LIMIT)) || null,
            fieldNames: fields.map(field => redactDeliveryEvidenceText(truncate(clean(field.name), 80))).filter(Boolean),
            fields: fields.map(field => ({
                name: redactDeliveryEvidenceText(truncate(clean(field.name), 80)),
                valuePreview: redactDeliveryEvidenceText(truncate(clean(field.value), 180)),
                inline: field.inline === true,
            })),
        },
        context: {
            orgId: clean(org.id),
            orgName: redactDeliveryEvidenceText(truncate(clean(org.name), 120)) || null,
            destinationId: clean(recordOrEmpty(context.destination).id),
            alertId: clean(alert.id),
            title: redactDeliveryEvidenceText(truncate(clean(alert.title), 160)),
            severity: clean(alert.severity),
            sourceFamily: clean(alert.sourceFamily) || clean(source.family),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id),
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name), 120)) || null,
            route: clean(delivery.route),
            casePath: clean(delivery.casePath),
            analystLink: clean(delivery.analystLink),
            dedupeKey: clean(delivery.dedupeKey) || clean(context.idempotencyKey),
            replay: delivery.replay === true,
            occurredAt: clean(context.occurredAt),
        },
        redaction: {
            endpointExposed: false,
            secretFields: [],
            safeForCustomerDisplay: true,
        },
    }
}

function buildDwmWebhookDeliveryOperationLinks(delivery: DwmWebhookDeliveryPublic) {
    const orgId = encodeURIComponent(delivery.orgId)
    const deliveryId = encodeURIComponent(delivery.id)
    const alertId = encodeURIComponent(delivery.alertId)
    const destinationId = delivery.destinationId ? encodeURIComponent(delivery.destinationId) : null
    const dedupeKey = delivery.idempotencyKey ? encodeURIComponent(dedupeFromIdempotencyKey(delivery.idempotencyKey) || delivery.idempotencyKey) : null
    return {
        deliveryDetail: `GET /api/dwm/webhook-deliveries?orgId=${orgId}&deliveryId=${deliveryId}`,
        deliveryHistory: destinationId
            ? `GET /api/dwm/webhook-deliveries?orgId=${orgId}&destinationId=${destinationId}&alertId=${alertId}`
            : `GET /api/dwm/webhook-deliveries?orgId=${orgId}&alertId=${alertId}`,
        retryDryRun: 'POST /api/dwm/webhook-deliveries',
        destinationTest: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : null,
        destinationDetail: destinationId ? `GET /api/dwm/webhooks?orgId=${orgId}&destinationId=${destinationId}` : null,
        destinationDelete: destinationId ? `DELETE /api/dwm/webhook-destinations/${destinationId}` : null,
        destinationArchive: destinationId ? `DELETE /api/dwm/webhook-destinations/${destinationId}` : null,
        dedupeHistory: dedupeKey ? `GET /api/dwm/webhook-deliveries?orgId=${orgId}&dedupeKey=${dedupeKey}` : null,
        casePath: delivery.casePath || null,
    }
}

function deliveryDestinationAvailability(attempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number]) {
    if (attempt.destinationId) {
        return {
            state: 'configured',
            code: null,
            label: null,
            type: null,
            status: null,
            message: 'Webhook destination is configured.',
            setupRoute: null,
            requestedDestinationId: null,
        }
    }

    const requestedDestination = attempt.redactedDestination.endpointHint === 'requested_destination_not_found'
    return {
        state: requestedDestination ? 'requested_destination_not_found' : 'missing_destination',
        code: 'destination_unavailable',
        label: requestedDestination ? 'Requested destination unavailable' : 'No webhook destination configured',
        type: 'webhook',
        status: 'unavailable',
        message: requestedDestination
            ? 'The requested webhook destination is not available for this organization. Choose an active destination or create one before retrying.'
            : 'No enabled webhook or Discord destination is configured for this organization. Create and test a destination before retrying.',
        setupRoute: 'POST /api/dwm/webhooks',
        requestedDestinationId: requestedDestination ? attempt.redactedDestination.endpointHash : null,
    }
}

export function buildDwmWebhookDestinationTestContract({
    destination,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    destination: DwmWebhookDestinationPublic | null
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const destinationId = destination?.id || null
    const scopedDeliveries = destinationId
        ? deliveries
            .filter(delivery => delivery.destinationId === destinationId && delivery.eventType === 'dwm.alert.test')
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        : []
    const latestTest = scopedDeliveries[0] || null
    const persistedLastTest = destination?.lastTestStatus
        ? {
            requestId: null,
            deliveryId: null,
            status: destination.lastTestStatus,
            dryRun: destination.lastTestStatus === 'dry_run',
            live: destination.lastTestStatus === 'delivered',
            responseStatus: destination.lastTestHttpStatus,
            error: destination.lastTestError ? redactDeliveryEvidenceText(destination.lastTestError) : null,
            attemptedAt: destination.lastTestedAt,
            payloadHash: null,
            idempotencyKey: null,
            source: 'destination_persistence',
        }
        : null
    const preview = latestTest ? buildDwmWebhookDeliveryPreview(latestTest) : null
    const testPayload = destination
        ? buildDwmAlertDeliveryPayload({
            destination: {
                id: destination.id,
                kind: destination.kind,
                name: destination.name,
                org_id: destination.orgId,
            },
            alert: buildTestAlert({ org_id: destination.orgId }),
            eventType: 'dwm.alert.test',
            deliveryId: `destination-test-preview:${destination.id}`,
        })
        : null
    const dryRunPayloadPreview = testPayload ? buildDwmWebhookDestinationTestPayloadPreview(testPayload) : null
    const health = destination
        ? buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents, liveDeliveryEnabled })[0] || null
        : null
    const auditContracts = buildDwmWebhookAuditEventContracts({
        auditEvents,
        deliveries,
        destinations: destination ? [destination] : [],
    })
    const latestAudit = latestTest
        ? auditContracts.find(audit => audit.deliveryId === latestTest.id) || null
        : destinationId
            ? auditContracts.find(audit => audit.destinationId === destinationId && audit.action === 'delivery.tested') || null
            : null
    const blockers: ReturnType<typeof testContractBlocker>[] = []
    if (!canManage) blockers.push(testContractBlocker('permission_denied', 'Only organization owners and admins can test webhook destinations.', destinationId))
    if (!destination) blockers.push(testContractBlocker('destination_missing', 'Webhook destination is not available for this organization.', null))
    if (destination && destination.status !== 'active') blockers.push(testContractBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', destination.id))
    if (destination && !destination.endpointHash && !destination.endpointHint) blockers.push(testContractBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', destination.id))
    if (!latestTest && !persistedLastTest) blockers.push(testContractBlocker('no_verified_dry_run', 'Destination has not recorded a dry-run test delivery yet.', destinationId, false))
    if (latestTest?.status === 'failed' || persistedLastTest?.status === 'failed' || health?.lastTest.status === 'failed') blockers.push(testContractBlocker('test_failed', 'Latest destination test failed.', destinationId))
    if (!latestAudit) blockers.push(testContractBlocker('audit_missing', 'Destination test has no linked audit event yet.', destinationId, false))
    if (!liveDeliveryEnabled) blockers.push(testContractBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; tests default to dry-run.', destinationId, false))
    const uniqueBlockers = uniqueTestContractBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const verified = latestTest?.status === 'dry_run'
        || latestTest?.status === 'delivered'
        || persistedLastTest?.status === 'dry_run'
        || persistedLastTest?.status === 'delivered'
    const latestTestStatus = latestTest?.status || persistedLastTest?.status || null
    const expectedIdempotencyKey = destination ? buildIdempotencyKey('dwm.alert.test', destination.orgId, destination.id, 'webhook_test') : null
    const testRoute = destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test'
    const canSendDryRunTest = Boolean(
        canManage
        && destination
        && destination.status === 'active'
        && !uniqueBlockers.some(blocker => blocker.blocking),
    )

    return {
        schemaVersion: 'dwm.webhook.destination_test.v1',
        orgId: destination?.orgId || latestTest?.orgId || null,
        destinationId,
        type: destination?.kind || null,
        label: destination?.name || null,
        status: verified ? 'verified' : latestTestStatus === 'failed' || health?.lastTest.status === 'failed' ? 'test_failed' : destination?.status === 'archived' || destination?.status === 'paused' ? 'disabled' : 'pending',
        noNetwork: true,
        liveDeliveryEnabled,
        externalSendEnabled: false,
        access: {
            role: clean(viewerRole) || null,
            canTest: Boolean(canManage && destination && destination.status === 'active' && blockingCodes.length === 0),
            canReadStatus: Boolean(destination || latestTest),
            memberSafe: !canManage,
        },
        redactedEndpoint: {
            endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : preview?.destination.endpointHint || null,
            endpointHash: destination?.endpointHash || preview?.destination.endpointHash || null,
        },
        latestTest: latestTest
            ? {
                requestId: latestTest.id,
                deliveryId: latestTest.id,
                status: latestTest.status,
                dryRun: latestTest.dryRun,
                live: !latestTest.dryRun && latestTest.status !== 'skipped',
                responseStatus: latestTest.responseStatus,
                error: latestTest.error ? redactDeliveryEvidenceText(latestTest.error) : null,
                attemptedAt: latestTest.attemptedAt,
                payloadHash: latestTest.payloadHash,
                idempotencyKey: latestTest.idempotencyKey,
                source: 'delivery_ledger',
            }
            : persistedLastTest,
        preview: preview
            ? {
                discord: {
                    content: preview.discord.content,
                    embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                    fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                        ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                        : [],
                    allowedMentions: preview.discord.allowedMentions,
                },
                context: preview.context,
                payloadHash: preview.payloadHash,
            }
            : null,
        dryRunPayloadPreview,
        dryRunTestRequest: {
            method: 'POST',
            route: testRoute,
            canSend: canSendDryRunTest,
            noNetwork: true,
            externalSendEnabled: false,
            body: destination
                ? {
                    orgId: destination.orgId,
                    destinationId: destination.id,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    idempotencyKey: expectedIdempotencyKey,
                }
                : null,
            expected: {
                deliveryStatus: 'dry_run',
                persistedAttempt: true,
                auditAction: 'delivery.tested',
                idempotencyKey: expectedIdempotencyKey,
                endpointExposed: false,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
        health: health
            ? {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                lastTest: health.lastTest,
                latestAuditEventId: health.latestAuditEventId,
            }
            : null,
        audit: {
            latestAuditEventId: latestAudit?.auditEventId || null,
            auditEventIds: auditContracts.filter(audit => audit.destinationId === destinationId).map(audit => audit.auditEventId),
            auditEventContracts: canManage ? auditContracts.filter(audit => audit.destinationId === destinationId).slice(0, 10) : [],
        },
        blockers: uniqueBlockers,
        blockingCodes,
        routes: {
            test: testRoute,
            destination: destinationId ? `GET /api/dwm/webhooks?destinationId=${destinationId}` : 'GET /api/dwm/webhooks',
        },
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
    const persistableSkipped = buildDwmAlertWebhookSkippedDeliveryIntents(plan)
    const destinationsById = new Map(candidateDestinations.map(destination => [destination.id, destination as DwmWebhookDestinationRow]))
    for (const skipped of persistableSkipped) {
        const destination = destinationsById.get(skipped.destinationId)
        if (!destination) continue
        deliveries.push(await recordSkippedSelectionDwmWebhookDelivery({
            ownerId,
            destination,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: skipped,
        }))
    }
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, destinationId || null)
    if (!plan.selectedDestinations.length && !persistableSkipped.length && missingIntent) {
        deliveries.push(await recordMissingDestinationDwmWebhookDelivery({
            ownerId,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: missingIntent,
        }))
    }
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

export function buildDwmAlertWebhookSkippedDeliveryIntents(
    plan: DwmAlertWebhookDispatchPlan
): DwmAlertWebhookSkippedDeliveryIntent[] {
    const normalizedAlert = normalizeAlert(plan.alert)
    const alertDedupe = normalizedAlert.dedupeKey || normalizedAlert.id
    return plan.skippedDestinations
        .filter(skipped => skipped.reason !== 'org_mismatch')
        .map(skipped => {
            const reason = skipped.reason as DwmAlertWebhookSkippedDeliveryIntent['reason']
            return {
                destinationId: skipped.id,
                orgId: skipped.orgId,
                status: skipped.status,
                reason,
                idempotencyKey: buildIdempotencyKey(plan.eventType, plan.orgId, skipped.id, alertDedupe),
                error: reason === 'disabled'
                    ? 'Delivery selection skipped because this destination is disabled.'
                    : `Delivery selection skipped because this destination is not subscribed to ${plan.eventType}.`,
                persistable: true as const,
            }
        })
}

export function buildDwmAlertWebhookMissingDeliveryIntent(
    plan: DwmAlertWebhookDispatchPlan,
    requestedDestinationId: string | null = null
): DwmAlertWebhookMissingDeliveryIntent | null {
    if (plan.selectedDestinations.length > 0) return null
    if (plan.skippedDestinations.some(skipped => skipped.reason !== 'org_mismatch')) return null

    const normalizedAlert = normalizeAlert(plan.alert)
    const reason = requestedDestinationId ? 'requested_destination_not_found' : 'missing_destination'
    return {
        orgId: plan.orgId,
        reason,
        requestedDestinationId,
        idempotencyKey: buildIdempotencyKey(plan.eventType, plan.orgId, requestedDestinationId || 'missing_destination', normalizedAlert.dedupeKey || normalizedAlert.id),
        error: requestedDestinationId
            ? 'Delivery selection skipped because the requested webhook destination was not found for this organization.'
            : 'Delivery selection skipped because no enabled webhook destination is configured for this organization.',
        persistable: true,
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
    const analystLink = normalizedAlert.alertUrl || normalizedAlert.casePath
    const context = {
        schemaVersion: 'dwm.webhook.v1',
        eventType,
        occurredAt: normalizedAlert.eventTimestamp,
        idempotencyKey,
        org: {
            id: destination.org_id,
            name: clean(alert.orgName) || clean(alert.organizationName) || destination.org_id,
            tenantId: normalizedAlert.tenantId,
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
            eventType,
            dryRunDefault: true,
            route: normalizedAlert.route,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            analystLink,
            dedupeKey: displayDedupeKey,
            replayCount: normalizedAlert.replayCount,
            workflowState: normalizedAlert.workflowState,
        },
        source: {
            family: normalizedAlert.sourceFamily,
            artifactType: normalizedAlert.artifactType,
            provenanceSummary: normalizedAlert.provenanceSummary,
            confidence: normalizedAlert.confidence,
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
                timestamp: normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt || context.occurredAt,
                fields: [
                    discordField('Organization', context.org.name, true),
                    discordField('Severity', normalizedAlert.severity.toUpperCase(), true),
                    discordField('Company / domain', normalizedAlert.companyOrDomain || normalizedAlert.matchedTerm.value || 'Not provided', true),
                    discordField('Observed at', normalizedAlert.eventTimestamp, true),
                    watchlist.name || watchlist.terms.length ? discordField('Watchlist', [watchlist.name, watchlist.terms[0]].filter(Boolean).join(' | '), true) : null,
                    discordField('Source family', normalizedAlert.sourceFamily || 'Unknown', true),
                    normalizedAlert.confidence.label ? discordField('Confidence', [normalizedAlert.confidence.label, normalizedAlert.confidence.reason].filter(Boolean).join(' | '), true) : null,
                    discordField('Evidence count', String(normalizedAlert.evidenceCount), true),
                    normalizedAlert.evidenceSummary ? discordField('Evidence summary', normalizedAlert.evidenceSummary, false) : null,
                    discordField('Route', normalizedAlert.route, true),
                    discordField('Workflow', workflowSummary(normalizedAlert, eventType), false),
                    discordField('Dedupe key', displayDedupeKey, false),
                    normalizedAlert.caseId ? discordField('Case ID', normalizedAlert.caseId, true) : null,
                    normalizedAlert.casePath ? discordField('Case', normalizedAlert.casePath, false) : null,
                    normalizedAlert.alertUrl ? discordField('Alert URL', normalizedAlert.alertUrl, false) : null,
                    analystLink ? discordField('Analyst link', analystLink, false) : null,
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
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const attemptCount = await countDwmWebhookDeliveryAttempts(ownerId, destination.org_id, destination.id, idempotencyKey) + 1

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
            responseBody = sanitizeDwmWebhookDeliveryDiagnostic(await response.text().catch(() => ''))
            status = response.ok ? 'delivered' : 'failed'
            error = response.ok ? null : sanitizeDwmWebhookDeliveryDiagnostic(`Webhook returned HTTP ${response.status}.`)
        } catch (sendError) {
            status = 'failed'
            error = sanitizeDwmWebhookDeliveryDiagnostic(sendError instanceof Error ? sendError.message : String(sendError))
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
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::JSONB, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
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
        classifyDeliveryError({ status, dryRun, responseStatus, error }),
        attemptCount,
        planDwmWebhookDeliveryRetry({ status, dryRun, responseStatus, error, attemptCount }).nextRetryAt,
        idempotencyKey,
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
        : delivery.status === 'failed'
            ? delivery.next_retry_at ? 'delivery.retry_scheduled' : 'delivery.failed'
            : delivery.status === 'skipped'
                ? 'delivery.skipped'
                : deliveryAuditActionForEvent(delivery.event_type)
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
            errorClass: delivery.error_class,
            attemptCount: delivery.attempt_count,
            nextRetryAt: delivery.next_retry_at,
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
    const attemptCount = await countDwmWebhookDeliveryAttempts(ownerId, destination.org_id, destination.id, idempotencyKey) + 1
    const errorClass = classifyDeliveryError({ status: 'skipped', dryRun: false, error })
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
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', FALSE, $7, $8, $9, $10::JSONB, NULL, NULL, $11, $12, $13, NULL, $14, $15, $16, $17, $18, NOW())
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
        errorClass,
        attemptCount,
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
            errorClass: delivery.error_class,
            attemptCount: delivery.attempt_count,
            nextRetryAt: delivery.next_retry_at,
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

async function recordSkippedSelectionDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookSkippedDeliveryIntent
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination, alert, eventType, deliveryId })
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const payloadHash = hashValue('payload', JSON.stringify(payload))
    const attemptCount = await countDwmWebhookDeliveryAttempts(ownerId, destination.org_id, destination.id, intent.idempotencyKey) + 1
    const errorClass = classifyDeliveryError({ status: 'skipped', dryRun, error: intent.error })
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
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7, $8, $9, $10, $11::JSONB, NULL, NULL, $12, $13, $14, NULL, $15, $16, $17, $18, $19, NOW())
        RETURNING *
    `, [
        deliveryId,
        destination.id,
        ownerId,
        destination.org_id,
        normalizedAlert.id,
        eventType,
        dryRun,
        destination.endpoint_hint,
        destination.endpoint_hash,
        payloadHash,
        JSON.stringify(payload),
        intent.error,
        errorClass,
        attemptCount,
        intent.idempotencyKey,
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
            errorClass: delivery.error_class,
            attemptCount: delivery.attempt_count,
            nextRetryAt: delivery.next_retry_at,
            idempotencyKey: delivery.idempotency_key,
            reason: intent.reason,
            watchlistId: delivery.watchlist_id,
            route: delivery.route,
            casePath: delivery.case_path,
        },
    })

    return toDwmWebhookDelivery(delivery)
}

async function recordMissingDestinationDwmWebhookDelivery({
    ownerId,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookMissingDeliveryIntent
}) {
    const deliveryId = crypto.randomUUID()
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const payload = buildDwmAlertDeliveryPayload({
        destination: {
            id: intent.requestedDestinationId || 'missing_destination',
            kind: 'webhook',
            name: 'Missing webhook destination',
            org_id: intent.orgId,
        },
        alert,
        eventType,
        deliveryId,
    })
    const payloadHash = hashValue('payload', JSON.stringify(payload))
    const attemptCount = await countDwmWebhookDeliveryAttempts(ownerId, intent.orgId, null, intent.idempotencyKey) + 1
    const errorClass = classifyDeliveryError({ status: 'skipped', dryRun, error: intent.error })
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
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, NULL, $2, $3, $4, $5, 'skipped', $6, $7, $8, $9, $10::JSONB, NULL, NULL, $11, $12, $13, NULL, $14, $15, $16, $17, $18, NOW())
        RETURNING *
    `, [
        deliveryId,
        ownerId,
        intent.orgId,
        normalizedAlert.id,
        eventType,
        dryRun,
        intent.requestedDestinationId ? 'requested_destination_not_found' : 'no_webhook_destination',
        intent.requestedDestinationId ? hashValue('endpoint', intent.requestedDestinationId) : 'no_webhook_destination',
        payloadHash,
        JSON.stringify(payload),
        intent.error,
        errorClass,
        attemptCount,
        intent.idempotencyKey,
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
        destinationId: null,
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
            errorClass: delivery.error_class,
            attemptCount: delivery.attempt_count,
            nextRetryAt: delivery.next_retry_at,
            idempotencyKey: delivery.idempotency_key,
            reason: intent.reason,
            requestedDestinationId: intent.requestedDestinationId,
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

async function countDwmWebhookDeliveryAttempts(
    ownerId: string,
    orgId: string,
    destinationId: string | null,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT COUNT(*)::INT AS count
        FROM dwm_webhook_deliveries
        WHERE owner_id = $1
          AND org_id = $2
          AND (($3::TEXT IS NULL AND destination_id IS NULL) OR destination_id = $3)
          AND idempotency_key = $4
    `, [ownerId, orgId, destinationId, idempotencyKey])

    return Number(result.rows[0]?.count ?? 0)
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
    const webhookContext = recordOrEmpty(alert.webhookContext)
    const workflowContext = recordOrEmpty(alert.workflowContext)
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
    const provenance = alert.provenance || webhookContext.provenance || {
        captureIds: cleanList(webhookContext.captureIds).length ? cleanList(webhookContext.captureIds) : cleanList(workflowContext.captureIds),
        sourceIds: cleanList(webhookContext.sourceIds).length ? cleanList(webhookContext.sourceIds) : cleanList(workflowContext.sourceIds),
        primaryCaptureId: firstClean(webhookContext.primaryCaptureId, workflowContext.primaryCaptureId),
    }
    const confidence = normalizeConfidence(
        firstPresent(alert.confidence, alert.confidenceScore, webhookContext.confidence, webhookContext.confidenceScore, workflowContext.confidence, workflowContext.confidenceScore),
        firstClean(alert.confidenceReason, alert.confidenceRationale, alert.reasoning, webhookContext.confidenceReason, workflowContext.confidenceReason)
    )
    const eventTimestamp = firstClean(
        alert.eventTimestamp,
        alert.occurredAt,
        webhookContext.eventTimestamp,
        workflowContext.eventTimestamp,
        alert.replayedAt,
        alert.updatedAt,
        alert.firstSeenAt,
        alert.createdAt
    )

    return {
        id,
        title,
        severity,
        tenantId: firstClean(alert.tenantId, webhookContext.tenantId, workflowContext.tenantId),
        company,
        domain,
        companyOrDomain: company || domain || matchedTerm.value,
        claimSummary: clean(alert.claimSummary) || clean(alert.summary) || 'A watched organization or asset matched newly collected threat intelligence.',
        recommendedAction: clean(alert.recommendedAction) || 'Review the evidence, validate the match, and contact the affected owner if exposure is confirmed.',
        matchedTerm,
        sourceFamily: firstClean(alert.sourceFamily, alert.source, webhookContext.sourceFamily, workflowContext.sourceFamily) || 'dark_web',
        artifactType: firstClean(alert.artifactType, alert.type, webhookContext.artifactType, workflowContext.artifactType) || 'mention',
        firstSeenAt: clean(alert.firstSeenAt) || clean(alert.createdAt) || eventTimestamp || new Date().toISOString(),
        eventTimestamp: eventTimestamp || clean(alert.firstSeenAt) || clean(alert.createdAt) || new Date().toISOString(),
        savedAt: clean(alert.savedAt) || null,
        reviewState: clean(alert.reviewState) || 'needs_review',
        deliveryState: clean(alert.deliveryState) || 'pending_review',
        workflowState: {
            review: clean(alert.reviewState) || 'needs_review',
            delivery: clean(alert.deliveryState) || 'pending_review',
        },
        replayCount: parseCount(alert.replayCount ?? webhookContext.replayCount ?? workflowContext.replayCount),
        confidence,
        route,
        casePath,
        alertUrl,
        caseId: clean(alert.caseId) || clean(alert.caseIdCandidate) || clean(workflowContext.caseIdCandidate),
        evidence,
        evidenceCount: evidence.length || evidenceCount,
        evidenceSummary: summarizeEvidence(evidence),
        dedupeKey: clean(alert.dedupeKey) || clean((alert.webhookDelivery as Record<string, unknown> | undefined)?.dedupeKey),
        provenance,
        provenanceSummary: provenanceSummary(provenance),
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

function buildTestAlert(destination: Pick<DwmWebhookDestinationRow, 'org_id'>) {
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

function normalizeConfidence(value: unknown, reason: unknown) {
    const raw = typeof value === 'number'
        ? value
        : Number(String(clean(value)).replace('%', ''))
    const score = Number.isFinite(raw)
        ? Math.max(0, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)))
        : null
    const label = score === null
        ? clean(value)
        : `${score}%`
    return {
        score,
        label,
        reason: truncate(clean(reason), 180),
    }
}

function workflowSummary(alert: ReturnType<typeof normalizeAlert>, eventType: DwmAlertEventType) {
    const parts = [
        eventType.replace('dwm.alert.', ''),
        `review ${alert.reviewState}`,
        `delivery ${alert.deliveryState}`,
        alert.replayCount ? `replay ${alert.replayCount}` : '',
    ].filter(Boolean)
    return parts.join(' | ')
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
    if (status === 'skipped') return 'skipped'
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
    if (action === 'delivery.created') return status || 'created'
    if (action === 'delivery.updated') return status || 'updated'
    if (action === 'delivery.tested') return 'tested'
    if (action === 'delivery.replayed') return status || 'replayed'
    if (action === 'delivery.retry_scheduled') return 'retry_scheduled'
    if (action === 'delivery.failed') return 'failed'
    if (action === 'delivery.delivered') return 'sent'
    if (action === 'delivery.skipped') return 'skipped'
    if (action === 'delivery.dry_run') return 'dry_run'
    return status || action.split('.').pop() || 'unknown'
}

function deliveryAuditActionForEvent(eventType: DwmAlertEventType) {
    if (eventType === 'dwm.alert.test') return 'delivery.tested'
    if (eventType === 'dwm.alert.replayed') return 'delivery.replayed'
    if (eventType === 'dwm.alert.updated') return 'delivery.updated'
    return 'delivery.created'
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

function webhookSetupRoutes(destinationId = '<destination_id>') {
    return {
        list: 'GET /api/dwm/webhooks?orgId=<org_id>',
        create: 'POST /api/dwm/webhooks',
        update: `PUT /api/dwm/webhook-destinations/${destinationId}`,
        disable: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        delete: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        archive: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        test: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
        deliver: 'POST /api/dwm/webhook-deliveries',
        deliveryHistory: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
    }
}

function auditTrailBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function testContractBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueTestContractBlockers(blockers: ReturnType<typeof testContractBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof testContractBlocker>[] = []
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

function orgAlertOutcomeBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueOrgAlertOutcomeBlockers(blockers: ReturnType<typeof orgAlertOutcomeBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof orgAlertOutcomeBlocker>[] = []
    for (const blocker of blockers) {
        const key = `${blocker.code}:${blocker.destinationId || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(blocker)
    }
    return unique
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

function alertDeliveryProofBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    blocking = true
) {
    return { code, message, destinationId, blocking }
}

function uniqueAlertDeliveryProofBlockers(blockers: ReturnType<typeof alertDeliveryProofBlocker>[]) {
    const seen = new Set<string>()
    const unique: ReturnType<typeof alertDeliveryProofBlocker>[] = []
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

function firstPresent(...values: unknown[]) {
    for (const value of values) {
        if (value === null || value === undefined) continue
        if (typeof value === 'string' && !value.trim()) continue
        return value
    }
    return null
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

export function sanitizeDwmWebhookDeliveryDiagnostic(value: unknown, max = 2000) {
    const text = clean(value)
    return text ? redactDeliveryEvidenceText(truncate(text, max)) : null
}

function redactNullableDeliveryText(value: string | null) {
    return value ? redactDeliveryEvidenceText(value) : null
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
