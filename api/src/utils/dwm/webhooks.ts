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
    audit_event_id?: string | null
    audit_action?: string | null
    audit_actor_id?: string | null
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
    caseActionId?: unknown
    caseActionPath?: unknown
    dedupeKey?: unknown
    requestId?: unknown
    deliveryId?: unknown
    idempotencyKey?: unknown
    action?: unknown
    status?: unknown
    timeFrom?: unknown
    timeTo?: unknown
    retryState?: unknown
    actorId?: unknown
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
        auditEventId: row.audit_event_id ?? null,
        auditAction: row.audit_action ?? null,
        auditActorId: row.audit_actor_id ?? null,
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
            SELECT deliveries.*,
                   audit.id AS audit_event_id,
                   audit.action AS audit_action,
                   audit.actor_id AS audit_actor_id
            FROM dwm_webhook_deliveries deliveries
            LEFT JOIN LATERAL (
                SELECT id, action, actor_id
                FROM dwm_webhook_audit_events
                WHERE delivery_id = deliveries.id
                ORDER BY created_at DESC
                LIMIT 1
            ) audit ON TRUE
            WHERE deliveries.org_id = $1
            ORDER BY deliveries.created_at DESC
            LIMIT 100
        `, [orgId])

        return (result.rows as DwmWebhookDeliveryRow[]).map(toDwmWebhookDelivery)
    }

    const result = await run(`
        SELECT deliveries.*,
               audit.id AS audit_event_id,
               audit.action AS audit_action,
               audit.actor_id AS audit_actor_id
        FROM dwm_webhook_deliveries deliveries
        LEFT JOIN LATERAL (
            SELECT id, action, actor_id
            FROM dwm_webhook_audit_events
            WHERE delivery_id = deliveries.id
            ORDER BY created_at DESC
            LIMIT 1
        ) audit ON TRUE
        WHERE deliveries.owner_id = $1
          AND ($2::TEXT IS NULL OR deliveries.org_id = $2)
        ORDER BY deliveries.created_at DESC
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
        caseActionId: clean(filters.caseActionId),
        caseActionPath: clean(filters.caseActionPath),
        dedupeKey: clean(filters.dedupeKey),
        requestId: clean(filters.requestId) || clean(filters.deliveryId),
        idempotencyKey: clean(filters.idempotencyKey),
        action: clean(filters.action),
        status: clean(filters.status),
        timeFrom: clean(filters.timeFrom),
        timeTo: clean(filters.timeTo),
        retryState: clean(filters.retryState),
        actorId: clean(filters.actorId),
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
            const caseActionId = clean(payloadDelivery.caseActionId) || clean(payloadAlert.caseActionId)
            const caseActionPath = clean(payloadDelivery.caseActionPath) || clean(payloadAlert.caseActionPath)
            const replay = delivery.eventType === 'dwm.alert.replayed' || payloadDelivery.replay === true
            const liveRequested = !delivery.dryRun
            const live = liveRequested && delivery.status !== 'skipped'
            const retryState = deliveryRetryFilterState(delivery)

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
                caseActionId,
                caseActionPath,
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
                actorId: audit?.actorId || null,
                retryState,
            }
        })
        .filter((evidence) => {
            if (normalizedFilters.orgId && evidence.orgId !== normalizedFilters.orgId) return false
            if (normalizedFilters.destinationId && evidence.destinationId !== normalizedFilters.destinationId) return false
            if (normalizedFilters.alertId && evidence.alertId !== normalizedFilters.alertId) return false
            if (normalizedFilters.casePath && evidence.casePath !== normalizedFilters.casePath) return false
            if (normalizedFilters.caseActionId && evidence.caseActionId !== normalizedFilters.caseActionId) return false
            if (normalizedFilters.caseActionPath && evidence.caseActionPath !== normalizedFilters.caseActionPath) return false
            if (normalizedFilters.dedupeKey && evidence.dedupeKey !== normalizedFilters.dedupeKey && evidence.idempotencyKey !== normalizedFilters.dedupeKey) return false
            if (normalizedFilters.requestId && evidence.requestId !== normalizedFilters.requestId && evidence.deliveryId !== normalizedFilters.requestId) return false
            if (normalizedFilters.idempotencyKey && evidence.idempotencyKey !== normalizedFilters.idempotencyKey) return false
            if (normalizedFilters.action && evidence.auditAction !== normalizedFilters.action && evidence.eventType !== normalizedFilters.action) return false
            if (normalizedFilters.status && evidence.status !== normalizedFilters.status && deliveryAttemptState(evidence.status, evidence.dryRun) !== normalizedFilters.status) return false
            if (normalizedFilters.retryState && evidence.retryState !== normalizedFilters.retryState) return false
            if (normalizedFilters.actorId && evidence.actorId !== normalizedFilters.actorId) return false
            if (normalizedFilters.timeFrom && String(evidence.attemptedAt || evidence.createdAt).localeCompare(normalizedFilters.timeFrom) < 0) return false
            if (normalizedFilters.timeTo && String(evidence.attemptedAt || evidence.createdAt).localeCompare(normalizedFilters.timeTo) > 0) return false
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
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
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
            retryState: item.retryState,
            retryable: Boolean(nextRetryAt) || retryPlan.retryable,
            retryReason: retryPlan.reason,
            payloadHash: item.payloadHash,
            auditEventId: item.auditEventId,
            auditAction: item.auditAction,
            actorId: item.actorId,
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
            caseActionId: attempt.caseActionId,
            caseActionPath: attempt.caseActionPath,
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
            actorId: audit?.actorId || attempt.actorId,
            retryState: attempt.retryState,
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
            caseActionId: clean(filters.caseActionId) || null,
            caseActionPath: clean(filters.caseActionPath) || null,
            dedupeKey: clean(filters.dedupeKey) || null,
            requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
            idempotencyKey: clean(filters.idempotencyKey) || null,
            action: clean(filters.action) || null,
            status: clean(filters.status) || null,
            timeFrom: clean(filters.timeFrom) || null,
            timeTo: clean(filters.timeTo) || null,
            retryState: clean(filters.retryState) || null,
            actorId: clean(filters.actorId) || null,
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
        const provenance = alert?.provenance || null

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
            route: operation.route,
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
                caseActionId: operation.caseActionId || clean(alert?.caseActionId),
                caseActionPath: operation.caseActionPath || clean(alert?.caseActionPath),
                provenance,
                provenanceIds: deliveryProvenanceIds(provenance),
                provenanceSummary: provenanceSummary(provenance),
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

export function buildDwmWebhookDeliveryHistoryConsumerProof({
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
    const attempts = buildDwmWebhookDeliveryAttemptPersistenceReadModel({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    const attemptByDeliveryId = new Map(attempts.rows.map(row => [row.deliveryId, row]))
    const rows = history.entries.map((entry) => {
        const attempt = attemptByDeliveryId.get(entry.deliveryId) || null
        const blockers = [
            ...(entry.destination.availability.code ? [retryQueueBlocker(entry.destination.availability.code, entry.destination.availability.message, entry.destinationId, true)] : []),
            ...(!entry.deliveryProof.auditEventId ? [retryQueueBlocker('audit_missing', 'Delivery attempt has no linked audit event yet.', entry.destinationId, false)] : []),
            ...(entry.retry.nextRetryAt ? [retryQueueBlocker('retry_scheduled', 'Delivery has a scheduled retry/backoff time.', entry.destinationId, false)] : []),
            ...(attempt?.replayHistory.duplicateLiveBlocked ? [retryQueueBlocker('duplicate_live_blocked', 'A live delivery for this destination and idempotency key was already delivered.', entry.destinationId, true)] : []),
            ...(!liveDeliveryEnabled && entry.liveRequested ? [retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, true)] : []),
        ]

        return {
            schemaVersion: 'dwm.webhook.delivery_history_consumer_row.v1',
            deliveryId: entry.deliveryId,
            requestId: entry.requestId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            watchlistId: entry.watchlist.id,
            eventType: entry.eventType,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            replay: entry.replay,
            dedupeKey: entry.alert.dedupeKey,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            redactedDestination: {
                id: entry.destination.id,
                label: entry.destination.label,
                type: entry.destination.type,
                status: entry.destination.status,
                enabled: entry.destination.enabled,
                endpointHint: entry.destination.redactedEndpoint.endpointHint,
                endpointHash: entry.destination.redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            discord: {
                title: entry.discordPreview?.title || entry.alert.title || null,
                fieldNames: entry.discordPreview?.fieldNames || [],
                content: entry.discordPreview?.content || null,
                alertLink: entry.alert.alertUrl || entry.alert.casePath || null,
                template: entry.sanitizedPayloadPreview?.discordTemplate || null,
                safeForCustomerDisplay: entry.sanitizedPayloadPreview?.redaction.safeForCustomerDisplay === true,
            },
            alert: {
                title: entry.alert.title,
                severity: entry.alert.severity,
                sourceFamily: entry.alert.sourceFamily,
                evidenceCount: entry.alert.evidenceCount,
                casePath: entry.alert.casePath,
                alertUrl: entry.alert.alertUrl,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
            },
            retry: {
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
            },
            idempotency: attempt?.idempotency || {
                duplicate: entry.dedupe.duplicateAttemptCount > 0,
                duplicateAttemptCount: entry.dedupe.duplicateAttemptCount,
                alreadyDelivered: entry.dedupe.alreadyDelivered,
                deliveredDeliveryId: null,
                latestDeliveryId: entry.deliveryId,
                deliveryIds: [entry.deliveryId],
            },
            replayHistory: attempt?.replayHistory || {
                replay: entry.replay,
                replayAttemptCount: entry.replay ? 1 : 0,
                dryRunAttemptCount: entry.dryRun ? 1 : 0,
                liveAttemptCount: entry.live ? 1 : 0,
                duplicateReplay: entry.replay && entry.dedupe.duplicateAttemptCount > 0,
                duplicateLiveBlocked: false,
            },
            audit: {
                auditEventId: entry.deliveryProof.auditEventId,
                action: entry.deliveryProof.auditAction,
                linked: Boolean(entry.deliveryProof.auditEventId),
            },
            response: entry.deliveryProof.response,
            error: entry.deliveryProof.error,
            routes: {
                deliveryDetail: entry.operationLinks?.deliveryDetail || null,
                deliveryHistory: entry.operationLinks?.deliveryHistory || null,
                retryDryRun: entry.operationLinks?.retryDryRun || 'POST /api/dwm/webhook-deliveries',
                destinationTest: entry.operationLinks?.destinationTest || null,
                destinationDetail: entry.operationLinks?.destinationDetail || null,
            },
            timestamps: {
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                attemptedAt: entry.deliveryProof.attemptedAt,
            },
            blockers: uniqueRetryQueueBlockers(blockers),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_history_consumer.v1',
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled,
        filters: history.filters,
        routes: {
            list: 'GET /api/dwm/webhook-deliveries',
            detail: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&deliveryId=<delivery_id>',
            retryDryRun: 'POST /api/dwm/webhook-deliveries',
        },
        routeContract: {
            schemaVersion: 'dwm.webhook.delivery_history_routes.v1',
            list: {
                method: 'GET' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'dedupeKey', 'deliveryId', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId'],
                noNetwork: true,
            },
            detail: {
                method: 'GET' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'deliveryId'],
                optionalQuery: ['destinationId', 'alertId', 'dedupeKey', 'idempotencyKey', 'action', 'status', 'retryState', 'actorId'],
                responseRowSchema: 'dwm.webhook.delivery_history_consumer_row.v1',
                noNetwork: true,
            },
            retryDryRun: {
                method: 'POST' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                noNetworkDefault: true,
            },
        },
        counts: {
            total: rows.length,
            auditLinked: rows.filter(row => row.audit.linked).length,
            retryScheduled: rows.filter(row => row.retry.nextRetryAt).length,
            duplicateReplay: rows.filter(row => row.replayHistory.duplicateReplay).length,
            duplicateLiveBlocked: rows.filter(row => row.replayHistory.duplicateLiveBlocked).length,
            redactedDestinations: rows.filter(row => row.redactedDestination.endpointExposed === false).length,
        },
        rows,
        blockers: rows.length
            ? []
            : [{
                code: 'no_delivery_history',
                message: 'No webhook delivery history matched the current filters.',
                blocking: false,
            }],
    }
}

export function buildDwmWebhookDeliveryReadinessConsumerProof({
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
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery readiness is not visible for this organization membership.', normalizedFilters.destinationId, true)

    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_readiness_consumer.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            routeContract: {
                list: {
                    method: 'GET' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredQuery: ['orgId'],
                    optionalQuery: ['destinationId', 'alertId', 'casePath', 'dedupeKey', 'deliveryId'],
                    noNetwork: true,
                },
                retryDryRun: {
                    method: 'POST' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                    noNetworkDefault: true,
                },
            },
            counts: {
                total: 0,
                success: 0,
                retryableFailure: 0,
                nonRetryableFailure: 0,
                idempotentReplay: 0,
                redactedDryRun: 0,
                crossOrgDenied: 1,
                auditLinked: 0,
            },
            rows: [],
            blockers: [permissionBlocker],
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                responseBodyExposed: false,
                webhookSecretExposed: false,
            },
        }
    }

    const history = buildDwmWebhookDeliveryHistoryConsumerProof({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const rows = history.rows.map((row) => {
        const retryableFailure = Boolean(row.retry.nextRetryAt) && !row.retry.terminalFailure && !row.idempotency.alreadyDelivered
        const nonRetryableFailure = row.retry.terminalFailure || row.blockers.some(blocker => blocker.code === 'terminal_failure')
        const success = row.status === 'sent' || row.rawStatus === 'delivered' || (row.rawStatus === 'dry_run' && row.dryRun)
        const idempotentReplay = row.replayHistory.duplicateReplay || row.idempotency.duplicate || row.idempotency.alreadyDelivered
        const redactedDryRun = row.dryRun && row.discord.safeForCustomerDisplay && row.redactedDestination.endpointExposed === false
        const state = nonRetryableFailure
            ? 'non_retryable_failure'
            : retryableFailure
                ? 'retryable_failure'
                : idempotentReplay
                    ? 'idempotent_replay'
                    : success
                        ? 'ready'
                        : 'blocked'
        const readinessBlockers = uniqueRetryQueueBlockers([
            ...row.blockers,
            ...(retryableFailure ? [retryQueueBlocker('retry_scheduled', 'Delivery has a scheduled retry/backoff time.', row.destinationId, false)] : []),
            ...(nonRetryableFailure ? [retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', row.destinationId, true)] : []),
            ...(!row.audit.linked ? [retryQueueBlocker('audit_missing', 'Delivery readiness has no linked audit event yet.', row.destinationId, false)] : []),
            ...(!liveDeliveryEnabled && row.live ? [retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled; this row is a dry run until delivery is enabled.', row.destinationId, false)] : []),
        ])

        return {
            schemaVersion: 'dwm.webhook.delivery_readiness_consumer_row.v1',
            deliveryId: row.deliveryId,
            requestId: row.requestId,
            orgId: row.orgId,
            destinationId: row.destinationId,
            alertId: row.alertId,
            watchlistId: row.watchlistId,
            eventType: row.eventType,
            state,
            status: row.status,
            rawStatus: row.rawStatus,
            dryRun: row.dryRun,
            live: row.live,
            replay: row.replay,
            idempotencyKey: row.idempotencyKey,
            dedupeKey: row.dedupeKey,
            context: {
                alertTitle: row.alert.title,
                severity: row.alert.severity,
                sourceFamily: row.alert.sourceFamily,
                evidenceCount: row.alert.evidenceCount,
                casePath: row.alert.casePath,
                alertUrl: row.alert.alertUrl,
                route: row.routes.deliveryDetail,
            },
            destination: {
                label: row.redactedDestination.label,
                type: row.redactedDestination.type,
                status: row.redactedDestination.status,
                endpointHash: row.redactedDestination.endpointHash,
                endpointHint: row.redactedDestination.endpointHint,
                endpointExposed: false,
            },
            readiness: {
                success,
                retryableFailure,
                nonRetryableFailure,
                idempotentReplay,
                redactedDryRun,
                auditLinked: row.audit.linked,
                retryEligible: retryableFailure && access.canRetry,
                liveBlocked: !liveDeliveryEnabled && row.live,
                safeForCustomerDisplay: true,
            },
            retry: row.retry,
            audit: row.audit,
            replayHistory: row.replayHistory,
            idempotency: row.idempotency,
            blockers: readinessBlockers,
            operationLinks: row.routes,
            timestamps: row.timestamps,
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                responseBodyExposed: false,
                webhookSecretExposed: false,
                payloadSecretExposed: false,
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_readiness_consumer.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: rows.some(row => row.live && !row.readiness.liveBlocked),
        visibility: decision,
        access,
        filters: history.filters,
        routeContract: {
            list: history.routeContract.list,
            detail: history.routeContract.detail,
            retryDryRun: history.routeContract.retryDryRun,
        },
        counts: {
            total: rows.length,
            success: rows.filter(row => row.readiness.success).length,
            retryableFailure: rows.filter(row => row.readiness.retryableFailure).length,
            nonRetryableFailure: rows.filter(row => row.readiness.nonRetryableFailure).length,
            idempotentReplay: rows.filter(row => row.readiness.idempotentReplay).length,
            redactedDryRun: rows.filter(row => row.readiness.redactedDryRun).length,
            crossOrgDenied: 0,
            auditLinked: rows.filter(row => row.readiness.auditLinked).length,
        },
        rows,
        blockers: rows.length
            ? uniqueRetryQueueBlockers(rows.flatMap(row => row.blockers))
            : [{
                code: 'no_delivery_history',
                message: 'No webhook delivery readiness rows matched the current filters.',
                blocking: false,
            }],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            responseBodyExposed: false,
            webhookSecretExposed: false,
        },
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
                watchlistItemId: entry.watchlist.id,
                watchlistId: entry.watchlist.id,
                watchlistName: entry.watchlist.name,
                caseId: entry.alert.caseId,
                casePath: entry.alert.casePath,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
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
            watchlistId: entry.watchlist.id,
            watchlistName: entry.watchlist.name,
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
                        watchlistId: entry.watchlist.id,
                        casePath: entry.alert.casePath,
                        caseActionId: entry.alert.caseActionId,
                        caseActionPath: entry.alert.caseActionPath,
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
            historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
                receipts: [],
                filters: normalizedFilters,
                access,
                liveDeliveryEnabled,
                blockers: [permissionBlocker],
            }),
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
            caseActionId: entry.alert.caseActionId,
            caseActionPath: entry.alert.caseActionPath,
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
            transitionReceipt: buildDwmWebhookDeliveryTransitionReceipt({
                entry,
                retryKey,
                blockers: uniqueBlockers,
                access,
                liveDeliveryEnabled,
            }),
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
        historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
            receipts,
            filters: history.filters,
            access,
            liveDeliveryEnabled,
            blockers: uniqueRetryQueueBlockers(receipts.flatMap(receipt => receipt.blockers)),
        }),
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
        const remediation = deliveryActionRemediation({
            action: primaryAction,
            orgId: item.orgId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            alertId: item.alertId,
            casePath: item.casePath,
            dedupeKey: item.dedupeKey,
            retryable: item.retry.retryable,
            terminalFailure,
            delivered,
            destinationUnavailable,
            destinationDisabled: Boolean(destinationDisabled),
            blockers,
            liveDeliveryEnabled,
        })

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
            remediation,
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

function deliveryActionRemediation({
    action,
    orgId,
    destinationId,
    deliveryId,
    alertId,
    casePath,
    dedupeKey,
    retryable,
    terminalFailure,
    delivered,
    destinationUnavailable,
    destinationDisabled,
    blockers,
    liveDeliveryEnabled,
}: {
    action: string
    orgId: string
    destinationId: string | null
    deliveryId: string | null
    alertId: string | null
    casePath: string | null
    dedupeKey: string | null
    retryable: boolean
    terminalFailure: boolean
    delivered: boolean
    destinationUnavailable: boolean
    destinationDisabled: boolean
    blockers: ReturnType<typeof retryQueueBlocker>[]
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const code = blockingCodes.includes('permission_denied')
        ? 'permission_denied'
        : destinationUnavailable
            ? 'configure_destination'
            : destinationDisabled
                ? 'enable_destination'
                : terminalFailure
                    ? 'rotate_or_disable_destination'
                    : retryable
                        ? 'retry_dry_run'
                        : delivered
                            ? 'monitor_delivery'
                            : 'test_destination'
    const nextSafeStep = code === 'retry_dry_run'
        ? 'Run a dry-run retry and inspect the recorded delivery receipt before enabling live delivery.'
        : code === 'configure_destination'
            ? 'Create or select an enabled org webhook destination, then run a dry-run test.'
            : code === 'enable_destination'
                ? 'Enable the destination and run a dry-run test before replaying alert delivery.'
                : code === 'rotate_or_disable_destination'
                    ? 'Rotate the webhook URL or disable the destination, then run a dry-run test to clear the terminal failure.'
                    : code === 'permission_denied'
                        ? 'Ask an organization owner or admin to review the destination and delivery history.'
                        : code === 'monitor_delivery'
                            ? 'No resend is needed; keep the delivery receipt and audit event for inspection.'
                            : 'Run a destination dry-run test to verify the Discord payload and destination health.'

    return {
        schemaVersion: 'dwm.webhook.delivery_remediation.v1',
        code,
        action,
        status: delivered ? 'resolved' : blockingCodes.length > 0 ? 'blocked' : 'ready',
        priority: terminalFailure || destinationUnavailable || destinationDisabled ? 'high' : retryable ? 'normal' : 'low',
        nextSafeStep,
        liveDeliveryEnabled,
        noNetworkDefault: true,
        externalSendEnabled: false,
        context: {
            orgId,
            destinationId,
            deliveryId,
            alertId,
            casePath,
            dedupeKey,
        },
        blockers: blockers.map(blocker => ({
            code: blocker.code,
            destinationId: blocker.destinationId,
            blocking: blocker.blocking,
        })),
        routeHints: {
            deliveryHistory: 'GET /api/dwm/webhook-deliveries',
            destinationTest: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : null,
            destinationUpdate: destinationId ? `PUT /api/dwm/webhook-destinations/${destinationId}` : null,
            dryRunReplay: 'POST /api/dwm/webhook-deliveries',
        },
        readiness: {
            dryRunReplayReady: code === 'retry_dry_run',
            liveReplayBlocked: !liveDeliveryEnabled,
            terminalFailure,
            destinationUnavailable,
            destinationDisabled,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
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
        const retryBlockerCodes = [
            destination && destination.status !== 'active' ? 'destination_disabled' : null,
            !latest.redactedDestination.endpointHash && !latest.redactedDestination.endpointHint ? 'missing_webhook_url' : null,
            !liveDeliveryEnabled ? 'live_delivery_disabled' : null,
            sent ? 'dedupe_already_delivered' : null,
            terminalFailure ? 'terminal_failure' : null,
            !retryable && !sent && !terminalFailure ? 'retry_not_eligible' : null,
            auditEventIds.length === 0 ? 'audit_missing' : null,
        ].filter(Boolean) as string[]
        const retryNextAction = sent
            ? 'delivery.retry_skipped_duplicate'
            : terminalFailure
                ? 'delivery.retry_terminal_failure'
                : retryable
                    ? 'delivery.retry_scheduled'
                    : 'delivery.retry_not_eligible'
        const retryCustomerAction = sent
            ? 'View delivered attempt before replaying.'
            : terminalFailure
                ? 'Fix the destination or payload issue before retrying.'
                : retryable
                    ? 'Run a dry-run retry and confirm the payload before enabling live delivery.'
                    : 'Review delivery evidence before retrying.'

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
                backoffPersisted: retryable && Boolean(latest.nextRetryAt),
                nextAuditAction: retryNextAction,
                nextCustomerAction: retryCustomerAction,
                blockerCodes: retryBlockerCodes,
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
            persistence: {
                rowKey: latest.idempotencyKey || key,
                primaryDeliveryId: latest.deliveryId,
                persistedDeliveryIds: sortedAttempts.map(attempt => attempt.deliveryId),
                persistedRequestIds: sortedAttempts.map(attempt => attempt.requestId),
                createdAt: sortedAttempts[sortedAttempts.length - 1]?.createdAt || null,
                updatedAt: latest.attemptedAt || latest.createdAt,
                latestStatus: latest.status,
                latestResponseStatus: latest.responseStatus,
                latestErrorCategory: latest.errorClass,
                auditEventIds,
                retryBackoffPersisted: retryable && Boolean(latest.nextRetryAt),
                nextRetryAt: retryable ? latest.nextRetryAt : null,
                nextAuditAction: retryNextAction,
                blockerCodes: retryBlockerCodes,
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    responseBodyExposed: false,
                    webhookSecretExposed: false,
                },
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

export function buildDwmWebhookDestinationLookupContract({
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
    const matrix = buildDwmWebhookDestinationDeliveryMatrix({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: matrix.destinations.length ? destinations : [],
        deliveries: matrix.destinations.length ? deliveries : [],
        auditEvents: matrix.destinations.length ? auditEvents : [],
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const adminByDestination = new Map(adminProof.destinations.map(destination => [destination.destinationId, destination]))
    const rows = matrix.destinations.map((destination) => {
        const proof = adminByDestination.get(destination.destinationId) || null
        return {
            schemaVersion: 'dwm.webhook.destination_lookup_row.v1',
            orgId: destination.orgId,
            destinationId: destination.destinationId,
            label: destination.label,
            type: destination.type,
            status: destination.status,
            enabled: destination.enabled,
            redactedDestination: {
                id: destination.destinationId,
                label: destination.label,
                type: destination.type,
                endpointHint: destination.redactedEndpoint.endpointHint,
                endpointHash: destination.redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            subscribedEvents: destination.subscribedEvents,
            delivery: {
                latestDeliveryAt: destination.deliveryProof.latestDeliveryAt,
                lastTestId: destination.deliveryProof.lastTest?.deliveryId || null,
                lastOrgAlertId: destination.deliveryProof.lastOrgAlert?.deliveryId || null,
                lastReplayId: destination.deliveryProof.lastReplayed?.deliveryId || null,
                latestAuditEventId: destination.health.latestAuditEventId || destination.audit.latestAuditEventId,
            },
            retry: {
                ready: destination.retry.ready,
                nextRetryAt: destination.retry.nextRetryAt,
                lastErrorCategory: destination.retry.lastErrorCategory,
                idempotencyKey: destination.retry.idempotencyKey,
            },
            replay: destination.replay,
            health: {
                status: destination.health.status,
                ready: destination.health.ready,
                states: destination.health.states,
                blockers: destination.health.blockers,
                productProgressStatus: adminProof.productProgress.status,
            },
            idempotency: {
                duplicateKeyCount: proof?.dedupe.duplicateKeyCount || 0,
                alreadyDelivered: proof?.dedupe.alreadyDelivered || false,
                latestDedupeKey: proof?.dedupe.latestDedupeKey || destination.replay.latestDedupeKey || null,
            },
            audit: {
                latestAuditEventId: destination.audit.latestAuditEventId || proof?.audit.latestAuditEventId || null,
                auditEventIds: destination.audit.auditEventIds,
                contracts: canManage ? destination.audit.auditEventContracts : [],
            },
            routes: {
                destinationDetail: `GET /api/dwm/webhooks?orgId=${encodeURIComponent(destination.orgId)}&destinationId=${encodeURIComponent(destination.destinationId)}`,
                deliveryHistory: destination.routes.detail,
                test: destination.routes.test,
                update: `PUT /api/dwm/webhook-destinations/${encodeURIComponent(destination.destinationId)}`,
                disable: destination.routes.delete,
                delete: destination.routes.delete,
                retryDryRun: matrix.routes.triggerDelivery,
            },
            blockers: destination.blockers,
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.destination_lookup.v1',
        noNetwork: true,
        liveDeliveryEnabled,
        visibility: matrix.visibility,
        access: matrix.access,
        routeContract: {
            schemaVersion: 'dwm.webhook.destination_lookup_routes.v1',
            list: {
                method: 'GET' as const,
                route: '/api/dwm/webhooks',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId'],
                responseRowSchema: 'dwm.webhook.destination_lookup_row.v1',
                noNetwork: true,
            },
            update: {
                method: 'PUT' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredBody: ['orgId'],
                optionalBody: ['name', 'label', 'endpointUrl', 'kind', 'events', 'status'],
                noNetwork: true,
            },
            test: {
                method: 'POST' as const,
                route: '/api/dwm/webhook-destinations/:id/test',
                requiredBody: ['orgId', 'dryRun'],
                noNetworkDefault: true,
            },
            disable: {
                method: 'DELETE' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredQuery: ['orgId'],
                noNetwork: true,
            },
        },
        summary: {
            destinationCount: rows.length,
            activeDestinationCount: rows.filter(row => row.enabled).length,
            readyDestinationCount: rows.filter(row => row.health.ready).length,
            retryReadyCount: rows.filter(row => row.retry.ready).length,
            auditLinkedCount: rows.filter(row => row.audit.latestAuditEventId).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
        },
        productProgress: adminProof.productProgress,
        destinations: rows,
        blockers: matrix.blockers,
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
                lifecycleCounts: {
                    active: 0,
                    disabled: 0,
                    failed: 0,
                    revokedOwner: 0,
                    secretRotated: 0,
                    testRequired: 0,
                },
                lifecycleActions: [],
            },
            blockers: policyBlockers,
            destinations: [],
        }
    }

    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const deliveriesById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const auditByDestination = new Map<string, typeof auditContracts>()
    const dashboardCanManage = ['owner', 'admin'].includes(clean(recordOrEmpty(visibility).role).toLowerCase())
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
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
        const latestDelivery = health.latestAttempt?.deliveryId ? deliveriesById.get(health.latestAttempt.deliveryId) || null : null
        const latestPayloadPreview = latestDelivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(latestDelivery.payload) : null
        const lifecycleState = destinationLifecycleState({
            destination: destinationById.get(health.destinationId) || null,
            health,
            audits: auditByDestination.get(health.destinationId) || [],
            canManage: dashboardCanManage,
        })
        const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage: dashboardCanManage })

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
            lifecycleState,
            lifecycleReadinessReceipt,
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
                discordTemplate: latestPayloadPreview?.context.discordTemplate || null,
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
            lifecycleCounts: {
                active: rows.filter(row => row.lifecycleState.active).length,
                disabled: rows.filter(row => row.lifecycleState.disabled).length,
                failed: rows.filter(row => row.lifecycleState.failed).length,
                revokedOwner: rows.filter(row => row.lifecycleState.revokedOwner).length,
                secretRotated: rows.filter(row => row.lifecycleState.secretRotated).length,
                testRequired: rows.filter(row => row.lifecycleState.testRequired).length,
            },
            lifecycleActions: dashboardLifecycleActionSummary(rows),
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
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
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
        const destination = destinationById.get(health.destinationId) || null
        const lifecycleState = destinationLifecycleState({ destination, health, audits, canManage })
        const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage })

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
            lifecycleState,
            lifecycleReadinessReceipt,
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
    const routeContract = destinationCrudRouteContract()
    const managementRequest = destinationCrudManagementRequest({
        action,
        orgId: normalizedOrgId,
        destinationId: destination?.id || null,
        requestId,
        label: normalizedLabel.slice(0, 120),
        kind: normalizedKind,
        channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
        status,
        events: parseEvents(input.events),
        redactedEndpoint: {
            endpointHint: normalizedEndpointHint,
            endpointHash: normalizedEndpointHash,
        },
        blockers: uniqueBlockers,
        canApply: blocking.length === 0,
        liveDeliveryEnabled,
    })
    const destinationPersistenceReceipt = destinationCrudPersistenceReceipt({
        action,
        orgId: normalizedOrgId,
        destination,
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
        managementRequest,
        blockers: uniqueBlockers,
        proofRow,
        duplicateDestinationId: duplicate?.id || null,
        liveDeliveryEnabled,
    })
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
        routeContract,
        managementRequest,
        destinationPersistenceReceipt,
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
    const deliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
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
    const organizationConsumerReceipt = buildDwmWebhookOrganizationConsumerReceipt({
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
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryReadinessConsumer,
        alertDeliveryProof,
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
        deliveryReadinessConsumer,
        organizationConsumerReceipt,
        auditEventContracts,
    }
}

function buildDwmWebhookOrganizationConsumerReceipt({
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
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryReadinessConsumer,
    alertDeliveryProof,
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
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryReadinessConsumer: ReturnType<typeof buildDwmWebhookDeliveryReadinessConsumerProof>
    alertDeliveryProof: ReturnType<typeof buildDwmWebhookAlertDeliveryProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const idempotencySeed = normalizedAlert.dedupeKey || normalizedAlert.id
    const readinessRows = new Map(deliveryReadinessConsumer.rows.map(row => [row.destinationId, row]))
    const latestOutcomeRows = new Map(deliveryOutcome.selectedDestinations.map(destination => [destination.destinationId, destination]))
    const selectedBlockingCodes = alertDeliveryProof.alertScopedBlockerCodes
    const skippedBlockerCodes = skippedDestinations.map((destination) => {
        if (destination.reason === 'disabled') return 'destination_disabled'
        if (destination.reason === 'org_mismatch') return 'org_mismatch'
        return destination.reason
    })
    const blockerCodes = [...new Set([
        ...selectedBlockingCodes,
        ...skippedBlockerCodes,
        ...(!orgId ? ['missing_org_ref'] : []),
        ...(selectedDestinations.length === 0 ? ['destination_unavailable'] : []),
        ...(!liveDeliveryEnabled && liveRequested && !dryRun ? ['live_delivery_disabled'] : []),
    ])]
    const destinationDeliveryReady = selectedDestinations.length > 0 && Boolean(orgId)
    const readyForDelivery = destinationDeliveryReady && selectedBlockingCodes.length === 0
    const dryRunReady = destinationDeliveryReady && (dryRun || !liveRequested || !liveDeliveryEnabled)
    const watchedTerms = (watchlist.terms.length ? watchlist.terms : [watchlist.name || watchlist.id])
        .map(term => clean(term))
        .filter(Boolean)

    return {
        schemaVersion: 'dwm.webhook.organization_delivery_consumer_receipt.v1',
        consumesSchemaVersion: 'organization.webhook_destination_delivery_consumer.v1',
        ownerId,
        organizationId: orgId,
        tenantId: orgId,
        route: 'POST /api/dwm/webhook-deliveries',
        upstreamRoute: 'POST /v1/dwm/webhooks/deliver',
        eventType,
        readyForDelivery,
        destinationDeliveryReady,
        dryRunReady,
        blockerReason: blockerCodes[0] || null,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled && readyForDelivery,
        roleGates: {
            automaticDelivery: ['owner', 'admin'],
            manualTrigger: ['owner', 'admin'],
            readDeliverySummary: ['owner', 'admin', 'member', 'viewer'],
        },
        destinationScope: {
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
        },
        alertContext: {
            alertId: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            route: normalizedAlert.route,
            alertUrl: normalizedAlert.alertUrl,
            caseId: normalizedAlert.caseId,
            casePath: normalizedAlert.casePath,
            evidenceCount: normalizedAlert.evidenceCount,
            provenanceSummary: normalizedAlert.provenanceSummary,
            dedupeKey: normalizedAlert.dedupeKey,
        },
        watchlistMatches: watchedTerms.map((term) => ({
            organizationId: orgId,
            tenantId: orgId,
            watchlistId: watchlist.id,
            watchlistItemId: watchlist.id,
            watchedEntity: {
                type: 'domain',
                value: term,
                normalizedValue: term.toLowerCase(),
            },
            matchReason: {
                kind: 'shared_watchlist_term',
                code: 'organization_watchlist_term_match',
            },
            actorRef: {
                userId: ownerId,
                role: 'admin',
                source: 'webhook_delivery_contract',
            },
            sourceRefs: {
                sourceFamily: normalizedAlert.sourceFamily,
                exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility',
                deliveryRoute: 'POST /api/dwm/webhook-deliveries',
            },
            provenanceHash: normalizedAlert.provenanceSummary || normalizedAlert.dedupeKey || normalizedAlert.id,
            workflowStatus: readyForDelivery ? 'ready_for_delivery' : 'blocked',
            destinationReadiness: {
                destinationDeliveryReady: readyForDelivery,
                dryRunReady,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                blockerReason: blockerCodes[0] || null,
            },
        })),
        destinationReceipts: selectedDestinations.map((destination) => {
            const idempotencyKey = buildIdempotencyKey(eventType, orgId, destination.id, idempotencySeed)
            const readiness = readinessRows.get(destination.id) || null
            const outcome = latestOutcomeRows.get(destination.id) || null
            return {
                destinationId: destination.id,
                orgId: destination.org_id,
                label: destination.name,
                type: destination.kind,
                status: outcome?.status || destination.status,
                idempotencyKey,
                requestId: outcome?.latestAttempt?.requestId || readiness?.requestId || null,
                deliveryId: outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || null,
                auditEventId: outcome?.latestAttempt?.auditEventId || readiness?.audit?.auditEventId || null,
                retry: {
                    retryable: Boolean(outcome?.latestAttempt?.retryable || readiness?.readiness.retryableFailure),
                    nextRetryAt: outcome?.latestAttempt?.nextRetryAt || readiness?.retry.nextRetryAt || null,
                    attemptCount: outcome?.latestAttempt?.attemptCount || readiness?.retry.attemptCount || 0,
                    lastErrorCategory: outcome?.latestAttempt?.errorClass || readiness?.retry.lastErrorCategory || null,
                },
                readiness: {
                    success: Boolean(readiness?.readiness.success || outcome?.recorded),
                    idempotentReplay: Boolean(readiness?.readiness.idempotentReplay),
                    redactedDryRun: Boolean(readiness?.readiness.redactedDryRun || outcome?.latestAttempt?.dryRun),
                    auditLinked: Boolean(readiness?.readiness.auditLinked || outcome?.latestAttempt?.auditEventId),
                    liveBlocked: !liveDeliveryEnabled && Boolean(outcome?.latestAttempt?.live || readiness?.live),
                },
                redactedDestination: {
                    endpointHash: readiness?.destination.endpointHash || null,
                    endpointHint: readiness?.destination.endpointHint || null,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                },
                routes: {
                    deliveryDetail: outcome?.operationLinks?.deliveryDetail || readiness?.operationLinks.deliveryDetail || `GET /api/dwm/webhook-deliveries/${outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || ':deliveryId'}`,
                    retryDryRun: readiness?.operationLinks.retryDryRun || 'POST /api/dwm/webhook-deliveries',
                    destinationTest: outcome?.operationLinks?.destinationTest || `POST /api/dwm/webhook-destinations/${destination.id}/test`,
                },
            }
        }),
        skippedDestinations: skippedDestinations.map(destination => ({
            destinationId: destination.id,
            orgId: destination.orgId,
            status: destination.status,
            reason: destination.reason,
            code: destination.reason === 'disabled' ? 'destination_disabled' : destination.reason,
        })),
        lifecycleBlockers: blockerCodes.filter(code => [
            'org_archived',
            'org_deleted',
            'member_revoked',
            'watchlist_paused',
            'watchlist_archived',
            'manual_webhook_selection_required',
            'role_not_allowed',
            'destination_disabled',
            'destination_unavailable',
            'missing_org_ref',
            'live_delivery_disabled',
        ].includes(code)),
        blockerCodes,
        audit: {
            auditEventIds: [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))],
            linked: auditEventContracts.length > 0,
            expectedActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
        },
        readiness: {
            alertDestinationReady: alertDestinationReadiness.ready,
            deliveryReadinessStatus: alertDeliveryProof.alertScopedStatus,
            recordedDeliveryStatus: alertDeliveryProof.delivery.recordedDeliveryStatus,
            retryableFailureCount: deliveryReadinessConsumer.counts.retryableFailure,
            nonRetryableFailureCount: deliveryReadinessConsumer.counts.nonRetryableFailure,
            idempotentReplayCount: deliveryReadinessConsumer.counts.idempotentReplay,
            redactedDryRunCount: deliveryReadinessConsumer.counts.redactedDryRun,
        },
        noLeakFields: ['destination.secret', 'destination.endpoint', 'otherOrg.destinationIds', 'case.evidence.rawContent'],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            responseBodyExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
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
            alertEventReadiness: {
                schemaVersion: 'dwm.webhook.alert_event_readiness_fixture.v1',
                consumesSchemaVersion: alertDestinationReadiness.alertEventConsumer.schemaVersion,
                noNetwork: true,
                externalSendEnabled: false,
                eventType,
                orgId,
                alertId: normalizedAlert.id,
                dedupeKey: normalizedAlert.dedupeKey,
                casePath: normalizedAlert.casePath,
                sourceFamily: normalizedAlert.sourceFamily,
                watchlistId: watchlist.id,
                provenanceSummary: normalizedAlert.provenanceSummary,
                selectedDestinationIds: [...selectedDestinationIds],
                expectedDeliveryAttempts: dryRunDeliveryRequests.map(request => ({
                    destinationId: request.destinationId,
                    idempotencyKey: request.expectedIdempotencyKey,
                    auditAction: request.expectedAuditAction,
                    dryRun: true,
                    live: false,
                })),
                payloadPreview: alertDestinationReadiness.alertEventConsumer.payloadPreview,
                payloadValidation: alertDestinationReadiness.alertEventConsumer.payloadValidation,
                readiness: {
                    ready: alertDestinationReadiness.alertEventConsumer.ready,
                    state: alertDestinationReadiness.alertEventConsumer.state,
                    blockerCodes: alertDestinationReadiness.alertEventConsumer.blockerCodes,
                    auditLinked: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditLinked,
                    auditMissing: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing,
                },
                blockers: alertScopedBlockers,
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                    payloadSecretExposed: false,
                },
            },
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
    const alertEventExpectedAuditAction = deliveryAuditActionForEvent(eventType)
    const alertEventAuditContracts = buildDwmWebhookAuditEventContracts({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
    })
    const selectedAlertEventAuditContracts = alertEventAuditContracts.filter((audit) => {
        const auditDestinationSelected = audit.destinationId ? selectedDestinationIds.has(audit.destinationId) : false
        const auditAlertMatches = audit.delivery?.alertId === normalizedAlert.id
        const auditDedupeMatches = Boolean(normalizedAlert.dedupeKey && audit.delivery?.idempotencyKey?.includes(normalizedAlert.dedupeKey))
        return audit.orgId === dispatch.orgId && (auditDestinationSelected || auditAlertMatches || auditDedupeMatches)
    })
    const firstSelectedDestination = dispatch.selectedDestinations[0] || null
    const alertEventPreviewPayload = firstSelectedDestination
        ? buildDwmAlertDeliveryPayload({
            destination: {
                id: firstSelectedDestination.id,
                kind: firstSelectedDestination.kind,
                name: firstSelectedDestination.name,
                org_id: dispatch.orgId,
            },
            eventType,
            deliveryId: '<dry_run_delivery_id>',
            alert: dispatch.alert,
        }) as Record<string, unknown>
        : null
    const alertEventPreviewContext = recordOrEmpty(alertEventPreviewPayload?._hanasand)
    const alertEventPreviewEmbeds = Array.isArray(alertEventPreviewPayload?.embeds)
        ? alertEventPreviewPayload.embeds as Array<Record<string, unknown>>
        : []
    const alertEventPreviewFields = Array.isArray(alertEventPreviewEmbeds[0]?.fields)
        ? (alertEventPreviewEmbeds[0]?.fields as Array<Record<string, unknown>>)
        : []
    const alertEventPreviewFieldNames = alertEventPreviewFields.map(field => clean(field.name)).filter(Boolean)
    const alertEventRequiredDiscordFields = ['Organization', 'Severity', 'Watchlist', 'Source family', 'Evidence count', 'Workflow', 'Dedupe key']
    const alertEventMissingDiscordFields = alertEventRequiredDiscordFields.filter(name => !alertEventPreviewFieldNames.includes(name))
    const alertEventDiscordLimits = {
        content: clean(alertEventPreviewPayload?.content).length <= DISCORD_CONTENT_LIMIT,
        embedCount: alertEventPreviewEmbeds.length <= 10,
        title: clean(alertEventPreviewEmbeds[0]?.title).length <= DISCORD_EMBED_TITLE_LIMIT,
        description: clean(alertEventPreviewEmbeds[0]?.description).length <= DISCORD_EMBED_DESCRIPTION_LIMIT,
        fields: alertEventPreviewFields.length <= DISCORD_EMBED_FIELD_LIMIT,
        fieldNames: alertEventPreviewFields.every(field => clean(field.name).length <= DISCORD_EMBED_FIELD_NAME_LIMIT),
        fieldValues: alertEventPreviewFields.every(field => clean(field.value).length <= DISCORD_EMBED_FIELD_VALUE_LIMIT),
    }
    const alertEventSerializedPreview = JSON.stringify(alertEventPreviewPayload || {})
    const alertEventDiscordTemplate = recordOrEmpty(alertEventPreviewContext.discordTemplate)
    const alertEventRedactionProof = {
        endpointExposed: false,
        webhookSecretExposed: false,
        responseBodyExposed: false,
        mentionsDisabled: Array.isArray(recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse)
            && (recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse as unknown[]).length === 0,
        noWebhookUrl: !/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/i.test(alertEventSerializedPreview),
    }
    const alertEventRedactionValid = !alertEventRedactionProof.endpointExposed
        && !alertEventRedactionProof.webhookSecretExposed
        && !alertEventRedactionProof.responseBodyExposed
        && alertEventRedactionProof.mentionsDisabled
        && alertEventRedactionProof.noWebhookUrl
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
        alertEventConsumer: {
            schemaVersion: 'dwm.webhook.alert_event_consumer.v1',
            consumesEventType: eventType,
            noNetwork: true,
            ready,
            state: ready ? 'ready' : dispatch.selectedDestinations.length > 0 ? 'blocked' : 'missing_destination',
            routeContract: {
                dryRunDelivery: {
                    method: 'POST',
                    route: '/api/dwm/webhook-deliveries',
                    requiredBody: ['organizationId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun', 'alert'],
                    noNetworkDefault: true,
                },
                deliveryHistory: {
                    method: 'GET',
                    route: '/api/dwm/webhook-deliveries',
                    requiredQuery: ['orgId', 'alertId'],
                    optionalQuery: ['destinationId', 'dedupeKey', 'casePath'],
                    noNetwork: true,
                },
            },
            requiredFields: {
                orgId: Boolean(dispatch.orgId),
                destinationId: Boolean(firstSelectedDestination?.id),
                alertId: Boolean(normalizedAlert.id),
                watchlistId: Boolean(watchlist.id),
                severity: Boolean(normalizedAlert.severity),
                title: Boolean(normalizedAlert.title),
                sourceFamily: Boolean(normalizedAlert.sourceFamily),
                evidence: normalizedAlert.evidenceCount > 0,
                provenance: Boolean(normalizedAlert.provenanceSummary),
                timestamp: Boolean(normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt),
                link: Boolean(normalizedAlert.alertUrl || normalizedAlert.casePath),
                dedupeKey: Boolean(normalizedAlert.dedupeKey),
            },
            persistenceTargets: {
                deliveryAttempt: true,
                deliveryHistory: true,
                retryPersistence: true,
                auditEvent: true,
                idempotencyKey: firstSelectedDestination
                    ? buildIdempotencyKey(eventType, dispatch.orgId, firstSelectedDestination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
                    : null,
            },
            auditReadiness: {
                schemaVersion: 'dwm.webhook.alert_event_audit_readiness.v1',
                expectedNextAction: alertEventExpectedAuditAction,
                expectedFailureAction: 'delivery.failed',
                expectedSkippedAction: 'delivery.skipped',
                expectedRetryAction: 'delivery.retry_scheduled',
                linkedAuditEventIds: selectedAlertEventAuditContracts.map(audit => audit.auditEventId),
                linkedActions: [...new Set(selectedAlertEventAuditContracts.map(audit => audit.action))],
                latestAuditEventId: selectedAlertEventAuditContracts[0]?.auditEventId || null,
                auditLinked: selectedAlertEventAuditContracts.length > 0,
                auditMissing: selectedAlertEventAuditContracts.length === 0,
                retryAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.retry_scheduled'),
                failureAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.failed'),
                skippedAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.skipped'),
                contracts: selectedAlertEventAuditContracts.slice(0, 5),
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                    metadataRedacted: true,
                },
            },
            payloadPreview: alertEventPreviewPayload && firstSelectedDestination
                ? {
                    schemaVersion: 'dwm.webhook.alert_event_payload_preview.v1',
                    destinationId: firstSelectedDestination.id,
                    redactedDestination: {
                        id: firstSelectedDestination.id,
                        label: firstSelectedDestination.name,
                        type: firstSelectedDestination.kind,
                        endpointExposed: false,
                    },
                    discord: {
                        content: clean(alertEventPreviewPayload.content),
                        embedCount: alertEventPreviewEmbeds.length,
                        fieldNames: alertEventPreviewFieldNames,
                    },
                    context: {
                        orgId: dispatch.orgId || null,
                        destinationId: firstSelectedDestination.id,
                        alertId: normalizedAlert.id,
                        watchlistId: watchlist.id,
                        watchlistTerm: watchlist.terms[0] || watchlist.name || null,
                        sourceFamily: normalizedAlert.sourceFamily,
                        evidenceCount: normalizedAlert.evidenceCount,
                        casePath: normalizedAlert.casePath,
                        routeUrl: normalizedAlert.alertUrl || normalizedAlert.casePath,
                        dedupeKey: normalizedAlert.dedupeKey,
                        replay: eventType === 'dwm.alert.replayed',
                        dryRun,
                        workflowStatus: workflowSummary(normalizedAlert, eventType),
                        provenanceIds: deliveryProvenanceIds(normalizedAlert.provenance),
                        discordTemplate: Object.keys(alertEventDiscordTemplate).length > 0
                            ? {
                                templateId: clean(alertEventDiscordTemplate.templateId),
                                ready: alertEventDiscordTemplate.ready === true,
                                missing: Array.isArray(alertEventDiscordTemplate.missing) ? alertEventDiscordTemplate.missing : [],
                                requiredFields: Array.isArray(alertEventDiscordTemplate.requiredFields) ? alertEventDiscordTemplate.requiredFields : [],
                                noNetworkDefault: alertEventDiscordTemplate.noNetworkDefault === true,
                            }
                            : null,
                    },
                    redaction: {
                        safeForCustomerDisplay: true,
                        endpointExposed: false,
                        webhookSecretExposed: false,
                        responseBodyExposed: false,
                    },
                }
                : null,
            payloadValidation: {
                schemaVersion: 'dwm.webhook.discord_payload_validation.v1',
                valid: Boolean(alertEventPreviewPayload && firstSelectedDestination)
                    && alertEventMissingDiscordFields.length === 0
                    && Object.values(alertEventDiscordLimits).every(Boolean)
                    && alertEventRedactionValid,
                requiredDiscordFields: alertEventRequiredDiscordFields,
                missingDiscordFields: alertEventMissingDiscordFields,
                limits: alertEventDiscordLimits,
                redaction: alertEventRedactionProof,
                context: {
                    orgId: Boolean(dispatch.orgId),
                    alertId: Boolean(normalizedAlert.id),
                    watchlistId: Boolean(watchlist.id),
                    sourceFamily: Boolean(normalizedAlert.sourceFamily),
                    evidence: normalizedAlert.evidenceCount > 0,
                    caseOrAlertLink: Boolean(normalizedAlert.alertUrl || normalizedAlert.casePath),
                    provenance: Boolean(normalizedAlert.provenanceSummary),
                },
            },
            blockers: uniqueBlockers,
            blockerCodes: blockingCodes,
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
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
                caseActionId: clean(payloadAlert.caseActionId) || clean(payloadDelivery.caseActionId),
                caseActionPath: clean(payloadAlert.caseActionPath) || clean(payloadDelivery.caseActionPath),
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
    const discordTemplate = sanitizeDiscordTemplateProof(context.discordTemplate)
    const firstEmbed = Array.isArray(embeds) ? recordOrEmpty(embeds[0]) : {}
    const fields = Array.isArray(firstEmbed.fields) ? firstEmbed.fields.map(recordOrEmpty) : []
    const content = redactDeliveryEvidenceText(truncate(clean(payload.content), DISCORD_CONTENT_LIMIT))
    const description = redactDeliveryEvidenceText(truncate(clean(firstEmbed.description), DISCORD_EMBED_DESCRIPTION_LIMIT))
    const fieldSummaries = fields.slice(0, DISCORD_EMBED_FIELD_LIMIT).map(field => ({
        name: truncate(redactDeliveryEvidenceText(clean(field.name) || 'Field'), 80),
        valuePreview: truncate(redactDeliveryEvidenceText(clean(field.value)), 180),
        inline: field.inline === true,
    }))
    const linkCandidates = [
        clean(deliveryContext.alertUrl),
        clean(alert.alertUrl),
        clean(deliveryContext.casePath),
        clean(alert.casePath),
        clean(deliveryContext.caseActionPath),
        clean(alert.caseActionPath),
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
        discordTemplate,
        context: {
            orgId: clean(org.id) || delivery.orgId,
            orgName: redactDeliveryEvidenceText(truncate(clean(org.name) || delivery.orgId, 120)),
            alertId: clean(alert.id) || delivery.alertId,
            alertTitle: redactDeliveryEvidenceText(truncate(clean(alert.title), 160)),
            severity: clean(alert.severity),
            matchReason: redactDeliveryEvidenceText(truncate(clean(alert.matchReason), 180)) || null,
            deliveryState: clean(alert.deliveryState) || clean(deliveryContext.deliveryState),
            sourceFamily: clean(alert.sourceFamily),
            evidenceTimestamp: clean(alert.evidenceTimestamp),
            eventTimestamp: clean(alert.eventTimestamp) || clean(deliveryContext.eventTimestamp) || clean(context.occurredAt),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id) || delivery.watchlistId,
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name) || delivery.watchlistName || '', 120)) || null,
            route: clean(deliveryContext.route) || delivery.route,
            casePath: clean(deliveryContext.casePath) || clean(alert.casePath) || delivery.casePath,
            caseActionId: clean(deliveryContext.caseActionId) || clean(alert.caseActionId) || null,
            caseActionPath: clean(deliveryContext.caseActionPath) || clean(alert.caseActionPath) || null,
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
    const discordTemplate = sanitizeDiscordTemplateProof(context.discordTemplate)
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
            matchReason: redactDeliveryEvidenceText(truncate(clean(alert.matchReason), 180)) || null,
            deliveryState: clean(alert.deliveryState) || clean(delivery.deliveryState),
            sourceFamily: clean(alert.sourceFamily) || clean(source.family),
            evidenceTimestamp: clean(alert.evidenceTimestamp),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id),
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name), 120)) || null,
            route: clean(delivery.route),
            casePath: clean(delivery.casePath),
            caseActionId: clean(delivery.caseActionId) || clean(alert.caseActionId) || null,
            caseActionPath: clean(delivery.caseActionPath) || clean(alert.caseActionPath) || null,
            analystLink: clean(delivery.analystLink),
            dedupeKey: clean(delivery.dedupeKey) || clean(context.idempotencyKey),
            replay: delivery.replay === true,
            occurredAt: clean(context.occurredAt),
            discordTemplate,
        },
        redaction: {
            endpointExposed: false,
            secretFields: [],
            safeForCustomerDisplay: true,
        },
    }
}

function sanitizeDiscordTemplateProof(template: unknown) {
    const record = recordOrEmpty(template)
    const templateId = clean(record.templateId)
    if (!templateId) return null
    const redaction = recordOrEmpty(record.redaction)
    return {
        schemaVersion: 'dwm.webhook.discord_payload_template_summary.v1',
        templateId,
        ready: record.ready === true,
        missing: cleanList(record.missing).slice(0, 12),
        requiredFields: cleanList(record.requiredFields).slice(0, DISCORD_EMBED_FIELD_LIMIT),
        fieldOrder: cleanList(record.fieldOrder).slice(0, DISCORD_EMBED_FIELD_LIMIT),
        noNetworkDefault: record.noNetworkDefault === true,
        redaction: {
            safeForCustomerDisplay: redaction.safeForCustomerDisplay !== false,
            endpointExposed: redaction.endpointExposed === true,
            webhookSecretExposed: redaction.webhookSecretExposed === true,
            mentionsDisabled: redaction.mentionsDisabled === true,
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
    const expectedPayloadHash = testPayload ? hashValue('payload', JSON.stringify(testPayload)) : null
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
        dryRunTestReceipt: {
            schemaVersion: 'dwm.webhook.destination_test_receipt.v1',
            noNetwork: true,
            externalSendEnabled: false,
            destinationId,
            orgId: destination?.orgId || null,
            status: 'dry_run',
            dryRun: true,
            live: false,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            idempotencyKey: expectedIdempotencyKey,
            payloadHash: expectedPayloadHash,
            redactedDestination: {
                id: destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null,
                endpointHash: destination?.endpointHash || null,
                endpointExposed: false,
            },
            expected: {
                deliveryStatus: 'dry_run',
                auditAction: 'delivery.tested',
                persistedAttempt: true,
                responseSummary: 'Dry-run delivery payload prepared without external network.',
            },
            retry: {
                attemptCount: 1,
                retryable: false,
                nextRetryAt: null,
                errorClass: null,
            },
            timestamps: {
                attemptedAt: null,
                createdAt: null,
                updatedAt: null,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
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

export function buildDwmWebhookDeliveryAttemptContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const live = parseBoolean(normalizedInput.live, false)
    const destinationMetadataById = new Map(destinations.map(destination => [destination.id, destination]))
    const dispatchDestinations = destinations.map(toDwmWebhookDispatchDestinationForContract)
    const plan = buildDwmAlertWebhookDispatchPlan({ ownerId, input: normalizedInput, destinations: dispatchDestinations })
    const alert = normalizeAlert(plan.alert)
    const watchlist = normalizeWatchlist(plan.alert.watchlist)
    const payloadContract = buildDwmWebhookDeliveryPayloadFieldContract({
        input: normalizedInput,
        plan,
        alert,
        watchlist,
        dryRun,
        live,
    })
    const requiredBlockers = deliveryAttemptContractBlockers({ input: normalizedInput, plan, alert, watchlist })
    const existingByIdempotencyKey = new Map<string, DwmWebhookDeliveryPublic[]>()
    for (const delivery of deliveries) {
        const idempotencyKey = clean(delivery.idempotencyKey)
        if (!idempotencyKey) continue
        const attempts = existingByIdempotencyKey.get(idempotencyKey) || []
        attempts.push(delivery)
        existingByIdempotencyKey.set(idempotencyKey, attempts)
    }
    const selectedAttempts = plan.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(plan.eventType, destination.org_id, destination.id, alert.dedupeKey || alert.id)
        const attemptCount = (existingByIdempotencyKey.get(idempotencyKey)?.length || 0) + 1
        const payload = buildDwmAlertDeliveryPayload({ destination, alert: plan.alert, eventType: plan.eventType, deliveryId: `delivery_contract_${destination.id}` })
        const preview = buildDwmWebhookDestinationTestPayloadPreview(payload)
        const retryPlan = planDwmWebhookDeliveryRetry({ status: dryRun ? 'dry_run' : 'skipped', dryRun, error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null, attemptCount })
        return {
            destinationId: destination.id,
            orgId: destination.org_id,
            alertId: alert.id,
            eventType: plan.eventType,
            status: dryRun ? 'dry_run' : live && liveDeliveryEnabled ? 'delivered' : 'skipped',
            dryRun,
            live: live && !dryRun && liveDeliveryEnabled,
            replay: plan.eventType === 'dwm.alert.replayed',
            dedupeKey: alert.dedupeKey || idempotencyKey,
            idempotencyKey,
            payloadHash: hashValue('payload', JSON.stringify(payload)),
            sanitizedPayloadPreview: preview,
            redactedDestination: {
                id: destination.id,
                label: destination.name,
                type: destination.kind,
                ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(destination.id)),
                endpointExposed: false,
            },
            responseSummary: dryRun ? 'Dry-run delivery payload prepared without external network.' : liveDeliveryEnabled ? 'Live delivery is explicitly enabled.' : 'Live delivery is disabled for this environment.',
            error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null,
            retry: {
                attemptCount,
                retryable: retryPlan.retryable,
                nextRetryAt: retryPlan.nextRetryAt,
                errorClass: retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            audit: {
                expectedAction: dryRun ? 'delivery.tested' : plan.eventType === 'dwm.alert.replayed' ? 'delivery.replayed' : 'delivery.created',
                auditEventId: null,
            },
            timestamps: {
                createdAt: null,
                updatedAt: null,
                attemptedAt: null,
            },
        }
    })
    const skippedAttempts = buildDwmAlertWebhookSkippedDeliveryIntents(plan).map(intent => ({
        destinationId: intent.destinationId,
        orgId: intent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || intent.idempotencyKey,
        idempotencyKey: intent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: intent.destinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(intent.destinationId)),
            endpointExposed: false,
        },
        responseSummary: intent.error,
        error: intent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(intent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: intent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }))
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, clean(normalizedInput.destinationId ?? normalizedInput.destination_id) || null)
    const missingAttempts = missingIntent ? [{
        destinationId: missingIntent.requestedDestinationId,
        orgId: missingIntent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || missingIntent.idempotencyKey,
        idempotencyKey: missingIntent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: missingIntent.requestedDestinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(clean(missingIntent.requestedDestinationId))),
            endpointExposed: false,
        },
        responseSummary: missingIntent.error,
        error: missingIntent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(missingIntent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: missingIntent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }] : []
    const attempts = [...selectedAttempts, ...skippedAttempts, ...missingAttempts]

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_contract.v1',
        ok: requiredBlockers.length === 0 && attempts.length > 0,
        ownerId,
        orgId: plan.orgId,
        eventType: plan.eventType,
        dryRun,
        liveRequested: live,
        externalSendEnabled: live && !dryRun && liveDeliveryEnabled,
        noNetwork: !(live && !dryRun && liveDeliveryEnabled),
        normalizedInput,
        payloadContract,
        requiredFields: {
            orgId: Boolean(firstClean(normalizedInput.orgId, normalizedInput.organizationId, normalizedInput.tenantId, (normalizedInput.alert as Record<string, unknown> | undefined)?.organizationId, (normalizedInput.alert as Record<string, unknown> | undefined)?.orgId, (normalizedInput.alert as Record<string, unknown> | undefined)?.tenantId)),
            destinationId: Boolean(clean(normalizedInput.destinationId ?? normalizedInput.destination_id)) || plan.selectedDestinations.length > 0,
            alertId: Boolean(firstClean(normalizedInput.alertId, (normalizedInput.alert as Record<string, unknown> | undefined)?.id)),
            watchlistId: Boolean(watchlist.id || clean(normalizedInput.watchlistItemId) || clean(normalizedInput.watchlistId)),
            severity: Boolean(firstClean((normalizedInput.alert as Record<string, unknown> | undefined)?.severity)),
            title: Boolean(firstClean((normalizedInput.alert as Record<string, unknown> | undefined)?.title)),
            sourceFamily: Boolean(firstClean(normalizedInput.sourceFamily, (normalizedInput.alert as Record<string, unknown> | undefined)?.sourceFamily)),
            evidence: alert.evidenceCount > 0 || alert.evidence.length > 0,
            provenance: Boolean(alert.provenanceSummary),
            timestamp: Boolean(alert.eventTimestamp),
            link: Boolean(alert.alertUrl || alert.casePath),
            dedupeKey: Boolean(firstClean(normalizedInput.dedupeKey, (normalizedInput.alert as Record<string, unknown> | undefined)?.dedupeKey)),
        },
        destinationSelection: {
            selectedDestinationIds: plan.selectedDestinations.map(destination => destination.id),
            skippedDestinations: plan.skippedDestinations,
        },
        attempts,
        blockers: requiredBlockers,
    }
}

function deliveryPayloadField(key: string, paths: string[], present: boolean) {
    return { key, paths, present }
}

function buildDwmWebhookDeliveryPayloadFieldContract({
    input,
    plan,
    alert,
    watchlist,
    dryRun,
    live,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    dryRun: boolean
    live: boolean
}) {
    const inputRecord = recordOrEmpty(input)
    const inputAlert = recordOrEmpty(input.alert)
    const required = [
        deliveryPayloadField('orgId', ['orgId', 'organizationId', 'tenantId', 'alert.organizationId', 'alert.orgId', 'alert.tenantId'], Boolean(firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId))),
        deliveryPayloadField('destinationId', ['destinationId', 'destination_id', 'destinations[].id'], Boolean(clean(input.destinationId ?? input.destination_id)) || plan.selectedDestinations.length > 0),
        deliveryPayloadField('alertId', ['alertId', 'alert.id'], Boolean(firstClean(input.alertId, inputAlert.id))),
        deliveryPayloadField('watchlistId', ['watchlistItemId', 'watchlistId', 'alert.watchlist.id'], Boolean(watchlist.id || clean(input.watchlistItemId) || clean(input.watchlistId))),
        deliveryPayloadField('severity', ['alert.severity'], Boolean(firstClean(inputAlert.severity))),
        deliveryPayloadField('title', ['alert.title'], Boolean(firstClean(inputAlert.title))),
        deliveryPayloadField('sourceFamily', ['sourceFamily', 'alert.sourceFamily'], Boolean(firstClean(input.sourceFamily, inputAlert.sourceFamily))),
        deliveryPayloadField('evidence', ['alert.evidence', 'alert.evidenceCount'], alert.evidenceCount > 0 || alert.evidence.length > 0),
        deliveryPayloadField('provenance', ['alert.provenance', 'alert.provenanceSummary'], Boolean(alert.provenanceSummary)),
        deliveryPayloadField('timestamp', ['alert.eventTimestamp', 'alert.detectedAt', 'alert.createdAt', 'alert.updatedAt'], Boolean(alert.eventTimestamp)),
        deliveryPayloadField('link', ['alert.alertUrl', 'alert.casePath', 'casePath', 'caseUrl'], Boolean(alert.alertUrl || alert.casePath)),
        deliveryPayloadField('dedupeKey', ['dedupeKey', 'alert.dedupeKey'], Boolean(firstClean(input.dedupeKey, inputAlert.dedupeKey))),
    ]
    const optional = [
        deliveryPayloadField('caseId', ['caseId', 'alert.caseId'], Boolean(firstClean(inputRecord.caseId, inputAlert.caseId))),
        deliveryPayloadField('casePath', ['casePath', 'caseUrl', 'alert.casePath', 'alert.caseUrl'], Boolean(alert.casePath)),
        deliveryPayloadField('caseAction', ['caseActionId', 'caseActionPath', 'actionId', 'actionPath', 'alert.caseActionId', 'alert.caseActionPath'], Boolean(alert.caseActionId || alert.caseActionPath)),
        deliveryPayloadField('route', ['route', 'recommendedRoute', 'alert.route', 'alert.recommendedRoute'], Boolean(alert.route)),
        deliveryPayloadField('confidence', ['alert.confidence', 'alert.confidenceScore', 'alert.confidenceReason'], Boolean(firstClean(inputAlert.confidence, inputAlert.confidenceScore, inputAlert.confidenceReason))),
        deliveryPayloadField('dryRunState', ['dryRun', 'dry_run'], true),
        deliveryPayloadField('liveState', ['live'], live),
        deliveryPayloadField('replayState', ['eventType', 'event_type'], plan.eventType === 'dwm.alert.replayed'),
    ]
    const missingRequired = required.filter(field => !field.present).map(field => field.key)
    return {
        schemaVersion: 'dwm.webhook.delivery_payload_contract.v1',
        noNetworkDefault: true,
        dryRun,
        liveRequested: live,
        replay: plan.eventType === 'dwm.alert.replayed',
        eventType: plan.eventType,
        required,
        optional,
        missingRequired,
    }
}

function deliveryAttemptRedactedEndpoint(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic | undefined) {
    const publicDestination = destination as DwmWebhookDestinationPublic | undefined
    return {
        endpointHint: publicDestination?.endpointHint ? redactDeliveryEvidenceText(publicDestination.endpointHint) : null,
        endpointHash: publicDestination?.endpointHash || null,
    }
}

export function buildDwmWebhookDeliveryAttemptPersistenceProof({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const contract = buildDwmWebhookDeliveryAttemptContract({
        ownerId,
        input,
        destinations,
        deliveries,
        liveDeliveryEnabled,
    })
    const auditsByDeliveryId = new Map<string, DwmWebhookAuditPublic>()
    for (const audit of auditEvents) {
        const deliveryId = clean(audit.deliveryId)
        if (deliveryId) auditsByDeliveryId.set(deliveryId, audit)
    }
    const rows = contract.attempts.map((attempt) => {
        const persisted = [...deliveries].reverse().find(delivery =>
            delivery.orgId === attempt.orgId
            && delivery.idempotencyKey === attempt.idempotencyKey
            && (delivery.destinationId === attempt.destinationId || (!delivery.destinationId && attempt.status === 'skipped'))
        ) || null
        const audit = persisted ? auditsByDeliveryId.get(persisted.id) || null : null
        const persistedPreview = persisted?.payload ? buildDwmWebhookDestinationTestPayloadPreview(persisted.payload) : null
        return {
            destinationId: attempt.destinationId,
            orgId: attempt.orgId,
            alertId: attempt.alertId,
            eventType: attempt.eventType,
            expectedStatus: attempt.status,
            persisted: Boolean(persisted),
            persistedDeliveryId: persisted?.id || null,
            persistedStatus: persisted?.status || null,
            dryRun: persisted?.dryRun ?? attempt.dryRun,
            live: persisted ? !persisted.dryRun && persisted.status !== 'skipped' : attempt.live,
            replay: attempt.replay,
            dedupeKey: attempt.dedupeKey,
            idempotencyKey: attempt.idempotencyKey,
            payloadHash: persisted?.payloadHash || attempt.payloadHash,
            redactedDestination: {
                ...attempt.redactedDestination,
                endpointHash: persisted?.endpointHash || null,
                endpointHint: persisted?.endpointHint || null,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: persistedPreview || attempt.sanitizedPayloadPreview,
            responseSummary: persisted?.responseBody || attempt.responseSummary,
            error: persisted?.error || attempt.error,
            retry: {
                attemptCount: persisted?.attemptCount ?? attempt.retry.attemptCount,
                retryable: persisted ? Boolean(persisted.nextRetryAt) : attempt.retry.retryable,
                nextRetryAt: persisted?.nextRetryAt || attempt.retry.nextRetryAt,
                errorClass: persisted?.errorClass || attempt.retry.errorClass,
                reason: persisted?.nextRetryAt ? 'retry_scheduled' : attempt.retry.reason,
            },
            audit: {
                expectedAction: attempt.audit.expectedAction,
                auditEventId: audit?.id || attempt.audit.auditEventId || null,
                action: audit?.action || null,
            },
            timestamps: {
                createdAt: persisted?.createdAt || attempt.timestamps.createdAt,
                updatedAt: persisted?.updatedAt || attempt.timestamps.updatedAt,
                attemptedAt: persisted?.attemptedAt || attempt.timestamps.attemptedAt,
            },
            blockers: persisted
                ? []
                : [{
                    code: 'delivery_attempt_not_persisted',
                    message: 'No persisted delivery row matched this expected destination and idempotency key.',
                    blocking: true,
                }],
        }
    })
    const missingPersisted = rows.filter(row => !row.persisted)
    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence.v1',
        ok: contract.ok && missingPersisted.length === 0,
        ownerId,
        orgId: contract.orgId,
        eventType: contract.eventType,
        dryRun: contract.dryRun,
        noNetwork: contract.noNetwork,
        externalSendEnabled: contract.externalSendEnabled,
        requiredFields: contract.requiredFields,
        destinationSelection: contract.destinationSelection,
        totals: {
            expectedAttempts: contract.attempts.length,
            persistedAttempts: rows.filter(row => row.persisted).length,
            missingAttempts: missingPersisted.length,
            retryScheduled: rows.filter(row => row.retry.nextRetryAt).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
        },
        rows,
        blockers: [
            ...contract.blockers,
            ...missingPersisted.map(row => ({
                code: 'delivery_attempt_not_persisted',
                destinationId: row.destinationId,
                idempotencyKey: row.idempotencyKey,
                message: 'Expected delivery attempt has not been persisted yet.',
                blocking: true,
            })),
        ],
    }
}

export function buildDwmWebhookDeliveryAttemptPersistenceReadModel({
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
    const evidence = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters })
    const auditByDeliveryId = new Map(auditEvents.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const attemptsByIdempotencyKey = new Map<string, typeof evidence>()
    for (const item of evidence) {
        const key = clean(item.idempotencyKey)
        if (!key) continue
        const attempts = attemptsByIdempotencyKey.get(key) || []
        attempts.push(item)
        attemptsByIdempotencyKey.set(key, attempts)
    }
    const rows = evidence.map((item) => {
        const delivery = deliveries.find(row => row.id === item.deliveryId) || null
        const audit = auditByDeliveryId.get(item.deliveryId) || null
        const destination = item.destinationId ? destinationById.get(item.destinationId) || null : null
        const idempotencyKey = clean(item.idempotencyKey)
        const idempotencyAttempts = [...(idempotencyKey ? attemptsByIdempotencyKey.get(idempotencyKey) || [] : [])]
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const deliveredAttempt = idempotencyAttempts.find(attempt => attempt.status === 'delivered' && !attempt.dryRun) || null
        const duplicateAttemptCount = idempotencyAttempts.length > 1 ? idempotencyAttempts.length : 0
        const retryPlan = planDwmWebhookDeliveryRetry({
            status: delivery?.status || item.status,
            dryRun: delivery?.dryRun ?? item.dryRun,
            responseStatus: delivery?.responseStatus ?? item.response.httpStatus,
            error: delivery?.error || item.error,
            attemptedAt: delivery?.attemptedAt || item.attemptedAt,
            attemptCount: delivery?.attemptCount || 1,
        })
        const replayBody = delivery ? {
            orgId: delivery.orgId,
            destinationId: delivery.destinationId,
            alertId: delivery.alertId,
            watchlistItemId: delivery.watchlistId,
            watchlistId: delivery.watchlistId,
            watchlistName: delivery.watchlistName,
            dedupeKey: dedupeFromIdempotencyKey(delivery.idempotencyKey) || delivery.idempotencyKey,
            eventType: 'dwm.alert.replayed' as DwmAlertEventType,
            route: delivery.route,
            casePath: delivery.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            dryRun: true,
            live: false,
        } : null
        const retryReady = Boolean(retryPlan.nextRetryAt || item.dryRun || item.status === 'failed' || item.status === 'skipped')
        return {
            deliveryId: item.deliveryId,
            requestId: item.requestId,
            destinationId: item.destinationId,
            orgId: item.orgId,
            alertId: item.alertId,
            eventType: item.eventType,
            status: item.status,
            dryRun: item.dryRun,
            live: item.live,
            replay: item.replay,
            dedupeKey: item.dedupeKey,
            idempotencyKey: item.idempotencyKey,
            watchlistId: item.watchlistId,
            watchlistName: item.watchlistName,
            casePath: item.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            payloadHash: item.payloadHash,
            redactedDestination: {
                id: item.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: item.redactedDestination.endpointHint,
                endpointHash: item.redactedDestination.endpointHash,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: delivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(delivery.payload) : null,
            responseSummary: item.response.summary,
            error: item.error,
            retry: {
                attemptCount: delivery?.attemptCount || 1,
                retryable: retryReady,
                nextRetryAt: delivery?.nextRetryAt || retryPlan.nextRetryAt,
                errorClass: delivery?.errorClass || retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            idempotency: {
                duplicate: duplicateAttemptCount > 0,
                duplicateAttemptCount,
                alreadyDelivered: Boolean(deliveredAttempt),
                deliveredDeliveryId: deliveredAttempt?.deliveryId || null,
                latestDeliveryId: idempotencyAttempts[0]?.deliveryId || null,
                deliveryIds: idempotencyAttempts.map(attempt => attempt.deliveryId).slice(0, 5),
            },
            replayHistory: {
                replay: item.replay,
                replayAttemptCount: idempotencyAttempts.filter(attempt => attempt.replay).length,
                dryRunAttemptCount: idempotencyAttempts.filter(attempt => attempt.dryRun).length,
                liveAttemptCount: idempotencyAttempts.filter(attempt => attempt.live).length,
                duplicateReplay: item.replay && duplicateAttemptCount > 0,
                duplicateLiveBlocked: Boolean(deliveredAttempt && item.status === 'skipped'),
            },
            audit: {
                auditEventId: item.auditEventId || audit?.id || null,
                action: item.auditAction || audit?.action || null,
            },
            timestamps: {
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                attemptedAt: item.attemptedAt,
            },
            actionRequests: {
                deliveryHistory: {
                    route: 'GET /api/dwm/webhook-deliveries',
                    query: {
                        orgId: item.orgId,
                        destinationId: item.destinationId,
                        alertId: item.alertId,
                        watchlistId: item.watchlistId,
                        casePath: item.casePath,
                        caseActionId: item.caseActionId,
                        caseActionPath: item.caseActionPath,
                        dedupeKey: item.dedupeKey,
                        deliveryId: item.deliveryId,
                    },
                },
                dryRunReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: retryReady,
                    noNetwork: true,
                    body: replayBody,
                    expectedStatus: 'dry_run',
                    expectedAuditAction: 'delivery.replayed',
                },
                liveReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: liveDeliveryEnabled && retryReady,
                    noNetwork: !liveDeliveryEnabled,
                    body: replayBody ? { ...replayBody, dryRun: false, live: true } : null,
                    blockers: liveDeliveryEnabled ? [] : [{
                        code: 'live_delivery_disabled',
                        message: 'Live webhook delivery is disabled for this environment.',
                        blocking: true,
                    }],
                },
            },
            operationLinks: delivery ? buildDwmWebhookDeliveryOperationLinks(delivery) : null,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence_read.v1',
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled,
        filters,
        total: rows.length,
        counts: {
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            replay: rows.filter(row => row.replay).length,
            retryable: rows.filter(row => row.retry.retryable).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
            duplicateIdempotencyKeys: rows.filter(row => row.idempotency.duplicate).length,
            duplicateReplayRows: rows.filter(row => row.replayHistory.duplicateReplay).length,
        },
        rows,
        blockers: rows.length
            ? []
            : [{
                code: 'no_delivery_attempts',
                message: 'No persisted webhook delivery attempts matched the current filters.',
                blocking: false,
            }],
    }
}

export function buildDwmWebhookDeliveryReplayApiContract({
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
    const readModel = buildDwmWebhookDeliveryAttemptPersistenceReadModel({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const guardByIdempotencyKey = new Map(replayGuard.entries.map(entry => [entry.idempotencyKey, entry]))
    const requests = readModel.rows.map((row) => {
        const guard = guardByIdempotencyKey.get(row.idempotencyKey) || null
        const permissionBlocked = replayGuard.access.canReplay !== true
        const dryRunBlockers = [
            ...(guard?.blockers || []).filter(blocker => blocker.blocking && blocker.code !== 'live_delivery_disabled'),
            ...(permissionBlocked ? [retryQueueBlocker('permission_denied', 'Only organization owners and admins can replay webhook deliveries.', row.destinationId, true)] : []),
        ]
        const dryRunAllowed = replayGuard.access.canReplay === true && dryRunBlockers.length === 0 && row.actionRequests.dryRunReplay.body !== null
        return {
            schemaVersion: 'dwm.webhook.delivery_replay_api_request.v1',
            deliveryId: row.deliveryId,
            requestId: row.requestId,
            destinationId: row.destinationId,
            orgId: row.orgId,
            alertId: row.alertId,
            watchlistId: row.watchlistId,
            watchlistName: row.watchlistName,
            casePath: row.casePath,
            caseActionId: row.caseActionId,
            caseActionPath: row.caseActionPath,
            dedupeKey: row.dedupeKey,
            idempotencyKey: row.idempotencyKey,
            replay: row.replay,
            status: row.status,
            redactedDestination: row.redactedDestination,
            idempotency: row.idempotency,
            replayHistory: row.replayHistory,
            latestAttempt: {
                status: row.status,
                dryRun: row.dryRun,
                live: row.live,
                attemptedAt: row.timestamps.attemptedAt,
                auditEventId: row.audit.auditEventId,
            },
            dryRunReplay: {
                route: 'POST /api/dwm/webhook-deliveries',
                canSend: dryRunAllowed,
                noNetwork: true,
                body: row.actionRequests.dryRunReplay.body,
                expectedStatus: 'dry_run',
                expectedAuditAction: 'delivery.replayed',
                blockers: uniqueRetryQueueBlockers(dryRunBlockers),
            },
            liveReplay: {
                route: 'POST /api/dwm/webhook-deliveries',
                canSend: guard?.guard.liveAllowed === true,
                noNetwork: !liveDeliveryEnabled,
                body: row.actionRequests.liveReplay.body,
                blockers: guard?.blockers || row.actionRequests.liveReplay.blockers,
            },
            retry: row.retry,
            audit: row.audit,
            operationLinks: row.operationLinks,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_replay_api.v1',
        noNetwork: true,
        externalSendEnabled: replayGuard.externalSendEnabled,
        liveDeliveryEnabled,
        access: replayGuard.access,
        visibility: replayGuard.visibility,
        filters: readModel.filters,
        counts: {
            total: requests.length,
            dryRunReady: requests.filter(request => request.dryRunReplay.canSend).length,
            liveReady: requests.filter(request => request.liveReplay.canSend).length,
            blocked: requests.filter(request => !request.dryRunReplay.canSend).length,
            auditLinked: requests.filter(request => request.audit.auditEventId).length,
        },
        requests,
        blockers: uniqueRetryQueueBlockers([
            ...replayGuard.blockers,
            ...requests.flatMap(request => request.dryRunReplay.blockers),
        ]),
    }
}

function toDwmWebhookDispatchDestinationForContract(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic): DwmWebhookDispatchDestination {
    const dispatchDestination = destination as DwmWebhookDispatchDestination
    const publicDestination = destination as DwmWebhookDestinationPublic
    return {
        id: destination.id,
        org_id: clean(dispatchDestination.org_id) || clean(publicDestination.orgId) || '',
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: Array.isArray(destination.events) ? destination.events : [],
    }
}

function deliveryAttemptContractBlockers({
    input,
    plan,
    alert,
    watchlist,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
}) {
    const blockers: Array<{ code: string; path: string; message: string; blocking: true }> = []
    const add = (code: string, path: string, message: string) => blockers.push({ code, path, message, blocking: true })
    const inputAlert = recordOrEmpty(input.alert)
    if (!firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId)) add('missing_org_id', 'orgId', 'Webhook delivery requires organization scope.')
    if (!firstClean(input.alertId, inputAlert.id)) add('missing_alert_id', 'alert.id', 'Webhook delivery requires a persisted alert id.')
    if (!firstClean(inputAlert.title)) add('missing_alert_title', 'alert.title', 'Webhook delivery requires an alert title for Discord rendering.')
    if (!firstClean(inputAlert.severity)) add('missing_severity', 'alert.severity', 'Webhook delivery requires alert severity.')
    if (!firstClean(input.sourceFamily, inputAlert.sourceFamily)) add('missing_source_family', 'alert.sourceFamily', 'Webhook delivery requires source family context.')
    if (!watchlist.id && !firstClean(input.watchlistItemId, input.watchlistId)) add('missing_watchlist_id', 'alert.watchlist.id', 'Webhook delivery requires watchlist identity.')
    if (!firstClean(input.dedupeKey, inputAlert.dedupeKey)) add('missing_dedupe_key', 'alert.dedupeKey', 'Webhook delivery requires a dedupe key for idempotency.')
    if (alert.evidenceCount <= 0 && alert.evidence.length === 0) add('missing_evidence', 'alert.evidence', 'Webhook delivery requires at least one evidence item or evidence count.')
    if (!alert.provenanceSummary) add('missing_provenance', 'alert.provenance', 'Webhook delivery requires source provenance context.')
    if (!alert.eventTimestamp) add('missing_timestamp', 'alert.eventTimestamp', 'Webhook delivery requires an alert event timestamp.')
    if (!alert.alertUrl && !alert.casePath) add('missing_alert_link', 'alert.alertUrl', 'Webhook delivery requires an alert or case link.')
    for (const destination of plan.selectedDestinations) {
        if (!WEBHOOK_KINDS.has(destination.kind)) {
            add('unsupported_destination_type', `destinations.${destination.id}.kind`, 'Webhook delivery only supports discord and webhook destinations.')
        }
    }
    if (!plan.selectedDestinations.length && !plan.skippedDestinations.some(destination => destination.reason !== 'org_mismatch')) {
        add('missing_destination', 'destinations', 'Webhook delivery requires an org-scoped destination or a persistable missing-destination attempt.')
    }
    return blockers
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
    const matchReason = matchReasonSummary(normalizedAlert)
    const alertContext = {
        ...normalizedAlert,
        matchReason,
    }
    const discordTemplate = buildDwmDiscordPayloadTemplateProof({
        eventType,
        normalizedAlert: alertContext,
        watchlist,
        analystLink,
        idempotencyKey,
    })
    const context = {
        schemaVersion: 'dwm.webhook.v1',
        eventType,
        occurredAt: normalizedAlert.eventTimestamp,
        discordTemplate,
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
        alert: alertContext,
        watchlist,
        delivery: {
            id: deliveryId,
            replay: eventType === 'dwm.alert.replayed',
            eventType,
            dryRunDefault: true,
            route: normalizedAlert.route,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            caseActionId: normalizedAlert.caseActionId,
            caseActionPath: normalizedAlert.caseActionPath,
            analystLink,
            deliveryState: normalizedAlert.deliveryState,
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
                    discordField('Match reason', matchReason, false),
                    discordField('Observed at', normalizedAlert.eventTimestamp, true),
                    watchlist.name || watchlist.terms.length ? discordField('Watchlist', [watchlist.name, watchlist.terms[0]].filter(Boolean).join(' | '), true) : null,
                    discordField('Source family', normalizedAlert.sourceFamily || 'Unknown', true),
                    normalizedAlert.confidence.label ? discordField('Confidence', [normalizedAlert.confidence.label, normalizedAlert.confidence.reason].filter(Boolean).join(' | '), true) : null,
                    discordField('Evidence count', String(normalizedAlert.evidenceCount), true),
                    discordField('Evidence timestamp', normalizedAlert.evidenceTimestamp, true),
                    normalizedAlert.evidenceSummary ? discordField('Evidence summary', normalizedAlert.evidenceSummary, false) : null,
                    discordField('Route', normalizedAlert.route, true),
                    discordField('Workflow', workflowSummary(normalizedAlert, eventType), false),
                    discordField('Delivery state', normalizedAlert.deliveryState, true),
                    discordField('Dedupe key', displayDedupeKey, false),
                    normalizedAlert.caseId ? discordField('Case ID', normalizedAlert.caseId, true) : null,
                    normalizedAlert.casePath ? discordField('Case', normalizedAlert.casePath, false) : null,
                    normalizedAlert.caseActionPath ? discordField('Case action', normalizedAlert.caseActionPath, false) : null,
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

function buildDwmDiscordPayloadTemplateProof({
    eventType,
    normalizedAlert,
    watchlist,
    analystLink,
    idempotencyKey,
}: {
    eventType: DwmAlertEventType
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    analystLink: string
    idempotencyKey: string
}) {
    const templateId = eventType === 'dwm.alert.replayed'
        ? 'dwm.discord.alert_replay.v1'
        : eventType === 'dwm.alert.updated'
            ? 'dwm.discord.alert_update.v1'
            : eventType === 'dwm.alert.test'
                ? 'dwm.discord.destination_test.v1'
                : 'dwm.discord.alert_created.v1'
    const requiredFields = [
        'Organization',
        'Severity',
        'Company / domain',
        'Match reason',
        'Observed at',
        'Watchlist',
        'Source family',
        'Evidence count',
        'Evidence timestamp',
        'Workflow',
        'Delivery state',
        'Dedupe key',
    ]
    const requiredPresence = {
        organization: true,
        severity: Boolean(normalizedAlert.severity),
        title: Boolean(normalizedAlert.title),
        companyOrDomain: Boolean(normalizedAlert.companyOrDomain || normalizedAlert.matchedTerm.value),
        matchReason: Boolean(matchReasonSummary(normalizedAlert)),
        observedAt: Boolean(normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt),
        watchlist: Boolean(watchlist.name || watchlist.terms.length || watchlist.id),
        sourceFamily: Boolean(normalizedAlert.sourceFamily),
        evidence: normalizedAlert.evidenceCount > 0,
        evidenceTimestamp: Boolean(normalizedAlert.evidenceTimestamp),
        workflow: Boolean(eventType),
        deliveryState: Boolean(normalizedAlert.deliveryState),
        dedupeKey: Boolean(normalizedAlert.dedupeKey || idempotencyKey),
        analystLink: Boolean(analystLink),
    }
    const missing = Object.entries(requiredPresence)
        .filter(([, present]) => !present)
        .map(([field]) => field)

    return {
        schemaVersion: 'dwm.webhook.discord_payload_template.v1',
        templateId,
        eventType,
        requiredFields,
        optionalFields: ['Confidence', 'Evidence summary', 'Case ID', 'Case', 'Case action', 'Alert URL', 'Analyst link', 'Provenance', 'Recommended action'],
        fieldOrder: [
            'Organization',
            'Severity',
            'Company / domain',
            'Match reason',
            'Observed at',
            'Watchlist',
            'Source family',
            'Confidence',
            'Evidence count',
            'Evidence timestamp',
            'Evidence summary',
            'Route',
            'Workflow',
            'Delivery state',
            'Dedupe key',
            'Case ID',
            'Case',
            'Case action',
            'Alert URL',
            'Analyst link',
            'Provenance',
            'Recommended action',
        ],
        requiredPresence,
        missing,
        ready: missing.length === 0,
        workflow: {
            replay: eventType === 'dwm.alert.replayed',
            update: eventType === 'dwm.alert.updated',
            test: eventType === 'dwm.alert.test',
            dryRunDefault: true,
        },
        limits: {
            content: DISCORD_CONTENT_LIMIT,
            title: DISCORD_EMBED_TITLE_LIMIT,
            description: DISCORD_EMBED_DESCRIPTION_LIMIT,
            fields: DISCORD_EMBED_FIELD_LIMIT,
            fieldName: DISCORD_EMBED_FIELD_NAME_LIMIT,
            fieldValue: DISCORD_EMBED_FIELD_VALUE_LIMIT,
        },
        noNetworkDefault: true,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            mentionsDisabled: true,
        },
    }
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
    const auditEventId = await recordDwmWebhookAudit({
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

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction,
        auditActorId: ownerId,
    }
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
    const auditEventId = await recordDwmWebhookAudit({
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

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction: 'delivery.skipped',
        auditActorId: ownerId,
    }
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
    const id = crypto.randomUUID()
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
        id,
        ownerId,
        actorId,
        orgId,
        destinationId,
        deliveryId,
        action,
        JSON.stringify(redactAuditMetadata(metadata)),
    ])
    return id
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
    const caseActionId = firstClean(alert.caseActionId, alert.actionId, webhookContext.caseActionId, webhookContext.actionId, workflowContext.caseActionId, workflowContext.actionId)
    const caseActionPath = firstClean(alert.caseActionPath, alert.actionPath, alert.actionUrl, webhookContext.caseActionPath, webhookContext.actionPath, webhookContext.actionUrl, workflowContext.caseActionPath, workflowContext.actionPath, workflowContext.actionUrl)
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
    const evidenceTimestamp = firstClean(
        alert.evidenceTimestamp,
        webhookContext.evidenceTimestamp,
        workflowContext.evidenceTimestamp,
        evidence.find(item => item.capturedAt)?.capturedAt,
        eventTimestamp
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
        evidenceTimestamp: evidenceTimestamp || eventTimestamp || clean(alert.firstSeenAt) || clean(alert.createdAt) || new Date().toISOString(),
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
        caseActionId,
        caseActionPath,
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
        recommendedAction: 'Nothing to do. Confirm this preview has the context your team expects.',
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

function matchReasonSummary(alert: ReturnType<typeof normalizeAlert>) {
    const term = clean(alert.matchedTerm.value)
    const kind = clean(alert.matchedTerm.kind)
    const confidenceReason = clean(alert.confidence.reason)
    const evidenceLead = alert.evidence[0]
    const evidenceContext = evidenceLead
        ? [evidenceLead.label, evidenceLead.source || evidenceLead.capturedAt].filter(Boolean).join(' | ')
        : ''
    const parts = [
        term ? `${kind && kind !== 'unknown' ? kind : 'term'} match: ${term}` : '',
        confidenceReason,
        evidenceContext,
    ].filter(Boolean)
    return truncate(parts.join(' | ') || alert.companyOrDomain || 'Matched watchlist evidence', DISCORD_EMBED_FIELD_VALUE_LIMIT)
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

function deliveryRetryFilterState(delivery: DwmWebhookDeliveryPublic) {
    if (delivery.nextRetryAt) return 'retry_scheduled'
    if (delivery.status === 'delivered') return 'delivered'
    if (delivery.dryRun && delivery.status === 'dry_run') return 'dry_run'
    if (delivery.status === 'skipped') {
        if (delivery.errorClass === 'duplicate_delivered_idempotency_key') return 'dedupe_already_delivered'
        if (delivery.errorClass === 'live_delivery_disabled') return 'live_delivery_disabled'
        return 'skipped'
    }
    if (delivery.status === 'failed') return 'terminal_failure'
    return 'none'
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

function destinationLifecycleState({
    destination,
    health,
    audits,
    canManage,
}: {
    destination: DwmWebhookDestinationPublic | null
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>
    canManage: boolean
}) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const latestSecretAudit = audits.find((audit) => {
        if (audit.action !== 'destination.updated') return false
        const metadata = recordOrEmpty(audit.metadata)
        return Boolean(clean(metadata.endpointHash) || clean(metadata.endpointHint) || clean(metadata.endpointUrl) || clean(metadata.webhookUrl))
    }) || null
    const latestSecretUpdateAt = latestSecretAudit?.createdAt || null
    const lastTestAt = health.lastTest.at || null
    const secretRotated = Boolean(
        latestSecretUpdateAt
        && (!lastTestAt || String(latestSecretUpdateAt).localeCompare(String(lastTestAt)) > 0)
    )
    const revokedOwner = Boolean(destination?.createdBy && destination?.ownerId && destination.createdBy !== destination.ownerId)
    const failed = health.lastTest.status === 'failed' || Boolean(
        health.lastFailure
        && !health.lastFailure.retryable
        && health.lastFailure.errorClass !== 'live_delivery_disabled'
    )
    const verified = health.lastTest.status === 'dry_run' || health.lastTest.status === 'delivered'
    const testRequired = health.enabled && endpointPresent && (!verified || secretRotated)
    const states = [
        health.enabled ? null : 'disabled',
        failed ? 'failed' : null,
        revokedOwner ? 'revoked_owner' : null,
        secretRotated ? 'secret_rotated' : null,
        testRequired ? 'test_required' : null,
        health.enabled && endpointPresent && verified && !failed && !revokedOwner && !secretRotated ? 'active' : null,
    ].filter(Boolean) as string[]
    const primary = states[0] || (health.enabled ? 'test_required' : 'disabled')
    const blockers = [
        !health.enabled ? lifecycleStateBlocker('disabled', 'Destination is disabled and will not receive alert deliveries.', health.destinationId, true) : null,
        failed ? lifecycleStateBlocker('failed', 'Latest destination test or delivery failed and needs remediation before live use.', health.destinationId, true) : null,
        revokedOwner ? lifecycleStateBlocker('revoked_owner', 'Destination was created by a user who no longer owns this destination record.', health.destinationId, true) : null,
        secretRotated ? lifecycleStateBlocker('secret_rotated', 'Webhook URL or secret reference changed after the last verified dry-run test.', health.destinationId, false) : null,
        testRequired ? lifecycleStateBlocker('test_required', 'Run a no-network dry-run test before relying on this destination.', health.destinationId, false) : null,
    ].filter(Boolean) as ReturnType<typeof lifecycleStateBlocker>[]

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_state.v1',
        primary,
        states: [...new Set(states)],
        active: states.includes('active'),
        disabled: states.includes('disabled'),
        failed: states.includes('failed'),
        revokedOwner: states.includes('revoked_owner'),
        secretRotated: states.includes('secret_rotated'),
        testRequired: states.includes('test_required'),
        verified,
        secretState: endpointPresent ? 'redacted' : 'missing',
        ownerState: revokedOwner ? 'revoked_owner' : 'current',
        owner: {
            ownerId: canManage ? destination?.ownerId || null : null,
            createdBy: canManage ? destination?.createdBy || null : null,
            actorExposed: canManage,
        },
        rotation: {
            rotatedAt: latestSecretUpdateAt,
            auditEventId: latestSecretAudit?.auditEventId || null,
            lastVerifiedTestAt: lastTestAt,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers,
        requiredActions: lifecycleStateActions({ destinationId: health.destinationId, blockers }),
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
    }
}

function lifecycleStateBlocker(
    code: 'disabled' | 'failed' | 'revoked_owner' | 'secret_rotated' | 'test_required',
    message: string,
    destinationId: string | null,
    blocking = false
) {
    return { code, message, destinationId, blocking }
}

function lifecycleStateActions({
    destinationId,
    blockers,
}: {
    destinationId: string
    blockers: ReturnType<typeof lifecycleStateBlocker>[]
}) {
    const codes = new Set(blockers.map(blocker => blocker.code))
    return {
        dryRunTest: codes.has('test_required') || codes.has('secret_rotated') || codes.has('failed')
            ? {
                route: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
                method: 'POST',
                body: { dryRun: true, live: false },
                noNetworkDefault: true,
            }
            : null,
        updateDestination: codes.has('failed') || codes.has('revoked_owner')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                noNetworkDefault: true,
            }
            : null,
        enableDestination: codes.has('disabled')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                body: { status: 'active' },
                noNetworkDefault: true,
            }
            : null,
    }
}

function destinationLifecycleReadinessReceipt({
    health,
    lifecycleState,
    canManage,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    lifecycleState: ReturnType<typeof destinationLifecycleState>
    canManage: boolean
}) {
    const terminalFailure = Boolean(
        health.lastFailure
        && !health.lastFailure.retryable
        && health.lastFailure.errorClass !== 'live_delivery_disabled'
    )
    const blockingCodes = lifecycleState.blockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const nextAction = lifecycleState.requiredActions.dryRunTest
        ? 'dry_run_test'
        : lifecycleState.requiredActions.enableDestination
            ? 'enable_destination'
            : lifecycleState.requiredActions.updateDestination
                ? 'review_destination'
                : health.retry.retryable
                    ? 'retry_delivery'
                    : health.ready
                        ? 'ready'
                        : 'inspect_destination'
    const nextDeliveryState = !health.enabled
        ? 'disabled'
        : terminalFailure
            ? 'terminal_failure'
            : health.retry.retryable
                ? 'retry_scheduled'
                : lifecycleState.testRequired
                    ? 'test_required'
                    : health.ready
                        ? 'ready'
                        : 'blocked'

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_readiness_receipt.v1',
        orgId: health.orgId,
        destinationId: health.destinationId,
        status: {
            lifecycle: lifecycleState.primary,
            health: health.health,
            nextDeliveryState,
            readyForDryRun: health.enabled && lifecycleState.secretState === 'redacted',
            readyForLive: health.ready && health.liveDeliveryEnabled && blockingCodes.length === 0,
            liveDeliveryEnabled: health.liveDeliveryEnabled,
        },
        nextAction,
        routes: {
            test: lifecycleState.requiredActions.dryRunTest?.route || `POST /api/dwm/webhook-destinations/${health.destinationId}/test`,
            update: lifecycleState.requiredActions.updateDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            enable: lifecycleState.requiredActions.enableDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            history: `/api/dwm/webhook-deliveries?orgId=${encodeURIComponent(health.orgId)}&destinationId=${encodeURIComponent(health.destinationId)}`,
        },
        actionBodyPreview: {
            dryRunTest: lifecycleState.requiredActions.dryRunTest?.body || null,
            enableDestination: lifecycleState.requiredActions.enableDestination?.body || null,
            updateDestination: lifecycleState.requiredActions.updateDestination ? { destinationId: health.destinationId } : null,
        },
        deliveryProof: {
            requestId: health.latestAttempt?.requestId || null,
            deliveryId: health.latestAttempt?.deliveryId || null,
            alertId: health.latestAttempt?.alertId || null,
            casePath: health.latestAttempt?.casePath || null,
            dedupeKey: health.latestAttempt?.dedupeKey || null,
            idempotencyKey: health.latestAttempt?.idempotencyKey || null,
            replay: health.latestAttempt?.replay ?? null,
            status: health.latestAttempt?.status || null,
            responseStatus: health.latestAttempt?.responseStatus || null,
            errorClass: health.latestAttempt?.errorClass || health.retry.errorClass || null,
            auditEventId: health.latestAttempt?.auditEventId || health.latestAuditEventId || null,
            attemptedAt: health.latestAttempt?.attemptedAt || null,
        },
        retry: {
            retryable: health.retry.retryable,
            nextRetryAt: health.retry.nextRetryAt,
            attemptCount: health.retry.attemptCount,
            lastErrorCategory: health.retry.errorClass,
            terminalFailure,
        },
        organizationLifecycleSettingsConsumer: {
            schemaVersion: 'dwm.webhook.organization_lifecycle_settings_consumer.v1',
            consumesSchemaVersion: 'organization.lifecycle_settings_mutation_receipt.v1',
            route: `PUT /api/organizations/${encodeURIComponent(health.orgId)}/settings`,
            readRoute: `GET /api/organizations/${encodeURIComponent(health.orgId)}/alert-readiness`,
            noNetwork: true,
            organizationId: health.orgId,
            destinationId: health.destinationId,
            expectedLifecycleStatuses: ['active', 'archived', 'deleted'],
            expectedDownstreamFields: [
                'settingsMutationReceipt.downstreamReadiness.webhookDeliveryReady',
                'settingsMutationReceipt.destinationReadiness.deliveryBlockedByLifecycle',
                'settingsMutationReceipt.destinationReadiness.nonmemberDestinationEnumeration',
                'settingsMutationReceipt.noLeakFields',
            ],
            deliveryBlockers: {
                archived: 'org_archived',
                deleted: 'org_deleted',
                active: null,
            },
            destinationReadiness: {
                deliveryBlockedByLifecycle: false,
                nonmemberDestinationEnumeration: false,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
            mutationPreview: {
                archive: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'archived' },
                    expectedWebhookDeliveryReady: false,
                    expectedBlocker: 'org_archived',
                },
                reactivate: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'active' },
                    expectedWebhookDeliveryReady: true,
                    expectedBlocker: null,
                },
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        audit: {
            latestAuditEventId: health.latestAuditEventId,
            auditEventIds: canManage ? health.auditEventIds : [],
            auditEventCount: health.auditEventIds.length,
            actorExposed: canManage,
        },
        redactedDestination: {
            label: health.label,
            type: health.type,
            endpointHint: health.redactedEndpoint.endpointHint,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers: lifecycleState.blockers,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
        noNetwork: true,
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

function deliveryProvenanceIds(value: unknown) {
    const record = recordOrEmpty(value)
    return {
        captureIds: cleanList(record.captureIds).slice(0, 5),
        sourceIds: cleanList(record.sourceIds).slice(0, 5),
        primaryCaptureId: clean(record.primaryCaptureId) || null,
    }
}

function buildDwmWebhookDeliveryTransitionReceipt({
    entry,
    retryKey,
    blockers,
    access,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryKey: ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys'][number] | null
    blockers: ReturnType<typeof retryQueueBlocker>[]
    access: { canRetry: boolean }
    liveDeliveryEnabled: boolean
}) {
    const uniqueBlockers = uniqueRetryQueueBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const canDryRunRetry = access.canRetry && entry.retry.retryable && blockingCodes.length === 0
    const canLiveRetry = canDryRunRetry && liveDeliveryEnabled
    const dedupeKey = retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const retryBody = {
        orgId: entry.orgId,
        organizationId: entry.orgId,
        destinationId: entry.destinationId,
        eventType: entry.eventType,
        alertId: entry.alert.id,
        dedupeKey,
        route: entry.route,
        casePath: entry.alert.casePath,
        caseId: entry.alert.caseId,
        watchlistItemId: entry.watchlist.id,
        watchlistId: entry.watchlist.id,
        watchlistName: entry.watchlist.name,
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
            dedupeKey,
            casePath: entry.alert.casePath,
            caseId: entry.alert.caseId,
            alertUrl: entry.alert.alertUrl,
            provenanceSummary: entry.alert.provenanceSummary,
            watchlist: {
                id: entry.watchlist.id,
                name: entry.watchlist.name,
                terms: entry.watchlist.terms,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
        },
    }
    const caseActionDryRunReceipt = buildDwmWebhookCaseActionDryRunReceipt({
        entry,
        retryBody,
        blockers: uniqueBlockers,
        canDryRunRetry,
        liveDeliveryEnabled,
    })
    const nextState = blockingCodes.includes('destination_unavailable')
        ? 'destination_unavailable'
        : blockingCodes.includes('destination_disabled')
            ? 'destination_disabled'
            : entry.dedupe.alreadyDelivered
                ? 'already_delivered'
                : entry.retry.terminalFailure
                    ? 'terminal_failure'
                    : canDryRunRetry
                        ? 'dry_run_retry_ready'
                        : entry.dryRun && entry.status !== 'failed'
                            ? 'dry_run_recorded'
                            : entry.status

    return {
        schemaVersion: 'dwm.webhook.delivery_transition_receipt.v1',
        org: {
            id: entry.orgId,
        },
        destinationId: entry.destinationId,
        redactedTarget: {
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
        },
        case: {
            id: entry.alert.caseId,
            path: entry.alert.casePath,
            alertUrl: entry.alert.alertUrl,
        },
        watchlist: {
            id: entry.watchlist.id,
            term: entry.watchlist.terms[0] || entry.watchlist.name || null,
            name: entry.watchlist.name,
        },
        provenance: {
            ...entry.alert.provenanceIds,
            summary: entry.alert.provenanceSummary || null,
        },
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: entry.dryRun,
            live: entry.live,
            route: entry.route,
            routeUrl: entry.alert.alertUrl || entry.alert.casePath || entry.route || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            auditAction: entry.deliveryProof.auditAction,
            auditEventIds: retryKey?.audit.auditEventIds || (entry.deliveryProof.auditEventId ? [entry.deliveryProof.auditEventId] : []),
        },
        state: {
            current: entry.status,
            rawStatus: entry.rawStatus,
            next: nextState,
            attemptedAt: entry.deliveryProof.attemptedAt,
            updatedAt: entry.deliveryProof.updatedAt,
        },
        retry: {
            retryable: entry.retry.retryable,
            attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
            nextRetryAt: entry.retry.nextRetryAt,
            lastErrorCategory: entry.retry.lastErrorCategory,
            terminalFailure: entry.retry.terminalFailure,
            dryRunReady: canDryRunRetry,
            liveReady: canLiveRetry,
        },
        requests: {
            dryRunRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRunRetry,
                blockers: canDryRunRetry ? [] : uniqueBlockers.filter(blocker => blocker.blocking),
                body: canDryRunRetry ? { ...retryBody, dryRun: true, live: false } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
            liveRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: !liveDeliveryEnabled,
                externalSendEnabled: canLiveRetry,
                canSend: canLiveRetry,
                blockers: canLiveRetry ? [] : uniqueRetryQueueBlockers([
                    ...(!liveDeliveryEnabled ? [retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, true)] : []),
                    ...uniqueBlockers,
                ]).filter(blocker => blocker.blocking),
                body: canLiveRetry ? { ...retryBody, dryRun: false, live: true } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
        },
        caseActionDryRunReceipt,
        denial: {
            denied: blockingCodes.length > 0 || !access.canRetry && entry.retry.retryable,
            blockers: uniqueBlockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
        },
    }
}

function buildDwmWebhookCaseActionDryRunReceipt({
    entry,
    retryBody,
    blockers,
    canDryRunRetry,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryBody: Record<string, unknown>
    blockers: ReturnType<typeof retryQueueBlocker>[]
    canDryRunRetry: boolean
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const body = canDryRunRetry
        ? {
            ...retryBody,
            dryRun: true,
            live: false,
            replay: entry.replay,
        }
        : null
    const casePath = entry.alert.casePath || null
    const caseId = entry.alert.caseId || null
    const dedupeKey = entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const routeUrl = entry.alert.alertUrl || casePath || entry.route || null
    const expectedAuditAction = entry.replay ? 'delivery.replayed' : 'delivery.retry_requested'
    const sourceHandoffReadinessConsumer = buildDwmWebhookAlertSourceHandoffReadinessConsumer({
        entry,
        blockers,
        dedupeKey,
        routeUrl,
    })

    return {
        schemaVersion: 'dwm.webhook.case_action_dry_run_receipt.v1',
        noNetwork: true,
        externalSendEnabled: false,
        liveDeliveryEnabled,
        ready: canDryRunRetry,
        org: {
            id: entry.orgId,
        },
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
        },
        case: {
            id: caseId,
            path: casePath,
            alertUrl: entry.alert.alertUrl,
            routeUrl: entry.alert.alertUrl || casePath || entry.route || null,
        },
        watchlist: {
            id: entry.watchlist.id,
            term: entry.watchlist.terms[0] || entry.watchlist.name || null,
            name: entry.watchlist.name,
        },
        provenance: {
            ...entry.alert.provenanceIds,
            summary: entry.alert.provenanceSummary || null,
        },
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: true,
            live: false,
            route: entry.route,
            routeUrl,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            currentAction: entry.deliveryProof.auditAction,
            expectedAction: expectedAuditAction,
        },
        bodyPreview: body,
        payloadPreview: entry.sanitizedPayloadPreview
            ? {
                schemaVersion: entry.sanitizedPayloadPreview.schemaVersion,
                payloadHash: entry.sanitizedPayloadPreview.payloadHash,
                discord: {
                    title: entry.discordPreview?.title || entry.alert.title || null,
                    fieldNames: entry.discordPreview?.fieldNames || [],
                    content: entry.discordPreview?.content || null,
                },
                context: {
                    alertId: entry.alert.id,
                    caseId,
                    casePath,
                    watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                    sourceFamily: entry.alert.sourceFamily,
                    routeUrl,
                },
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    payloadExposed: false,
                },
            }
            : null,
        historyQuery: {
            method: 'GET' as const,
            route: 'GET /api/dwm/webhook-deliveries',
            query: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                casePath,
                dedupeKey,
                deliveryId: entry.deliveryId,
            },
            noNetwork: true as const,
        },
        actionRequest: {
            method: 'POST' as const,
            route: 'POST /api/dwm/webhook-deliveries',
            canSend: canDryRunRetry,
            body,
            expectedAuditAction,
            blockers: canDryRunRetry ? [] : blockers.filter(blocker => blocker.blocking),
            noNetwork: true as const,
            externalSendEnabled: false as const,
        },
        caseReplayExportConsumer: {
            schemaVersion: 'dwm.webhook.case_replay_export_consumer.v1',
            consumesSchemaVersion: 'dwm.case_action_replay_export.v1',
            route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}/action-replay-export` : '/v1/cases/:caseId/action-replay-export',
            method: 'GET' as const,
            noNetwork: true,
            ready: Boolean(caseId && entry.orgId),
            query: {
                organizationId: entry.orgId,
                actionId: entry.replay ? 'alertReplay' : 'webhookDryRun',
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
            expectedFields: [
                'schemaVersion',
                'caseId',
                'organizationId',
                'alertId',
                'handoffActionReadiness',
                'handoffActionHistory.receipts[]',
                'workflowTransitions[]',
                'replayPlan.blockerCodes',
                'provenance.captureIds',
                'auditSafety.webhookSecretExposed',
            ],
            webhookContext: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                caseId,
                casePath,
                watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                sourceFamily: entry.alert.sourceFamily,
                routeUrl,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
                auditEventId: entry.deliveryProof.auditEventId,
                expectedAuditAction,
            },
            deliveryState: {
                status: entry.status,
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
                blockers: blockers.map(blocker => blocker.code),
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        caseWebhookReplayReadinessConsumer: {
            schemaVersion: 'dwm.webhook.case_webhook_replay_readiness_consumer.v1',
            consumesSchemaVersion: 'dwm.case_webhook_replay_readiness_response.v1',
            route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}/webhook-replay-readiness` : '/v1/cases/:caseId/webhook-replay-readiness',
            method: 'GET' as const,
            noNetwork: true,
            ready: Boolean(caseId && entry.orgId),
            query: {
                organizationId: entry.orgId,
                deliveryId: entry.deliveryId,
                destinationId: entry.destinationId,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
            expectedFields: [
                'schemaVersion',
                'caseId',
                'organizationId',
                'webhookDryRunReadiness.readyForReplay',
                'webhookDeliveryReplayContext.retryState.nextRetryAt',
                'webhookDeliveryReplayContext.summary.deliveryIds',
                'customerNotificationReadiness.blockerCodes',
                'nextWebhookActions[].id',
                'auditSafety.webhookSecretExposed',
            ],
            webhookContext: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                caseId,
                casePath,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
                watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                sourceFamily: entry.alert.sourceFamily,
                routeUrl,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
                auditEventId: entry.deliveryProof.auditEventId,
                expectedAuditAction,
            },
            deliveryState: {
                status: entry.status,
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
                dryRunReceiptAvailable: entry.dryRun,
                replay: entry.replay,
                blockers: blockers.map(blocker => blocker.code),
            },
            nextWebhookActionIds: ['run_webhook_dry_run', 'retry_webhook_delivery', 'record_customer_notification'],
            roleGates: {
                replay: ['owner', 'admin'],
                retry: ['owner', 'admin'],
                readSummary: ['owner', 'admin', 'member', 'viewer'],
            },
            readiness: {
                dryRunReady: canDryRunRetry,
                retryableDelivery: entry.retry.retryable,
                idempotentReplay: entry.replay && entry.dedupe.duplicateAttemptCount > 0,
                auditLinked: Boolean(entry.deliveryProof.auditEventId),
                redactedPayload: true,
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                payloadBodyExposed: false,
                webhookSecretExposed: false,
            },
        },
        sourceHandoffReadinessConsumer,
        denial: {
            denied: blockingCodes.length > 0,
            blockingCodes,
            blockers,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'endpointSecret', 'endpoint_encrypted'],
        },
    }
}

function buildDwmWebhookAlertSourceHandoffReadinessConsumer({
    entry,
    blockers,
    dedupeKey,
    routeUrl,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    blockers: ReturnType<typeof retryQueueBlocker>[]
    dedupeKey: string | null
    routeUrl: string | null
}) {
    const captureIds = entry.alert.provenanceIds.captureIds || []
    const sourceIds = entry.alert.provenanceIds.sourceIds || []
    const sourceReady = Boolean(entry.alert.sourceFamily && entry.alert.evidenceCount > 0 && captureIds.length > 0 && sourceIds.length > 0)
    const destinationReady = Boolean(entry.destinationId && entry.destination.enabled !== false && entry.destination.status !== 'disabled')
    const deliveryReady = destinationReady && !blockers.some(blocker => blocker.blocking && ['destination_unavailable', 'destination_disabled', 'permission_denied'].includes(blocker.code))
    const state = sourceReady && deliveryReady
        ? 'ready_for_consumers'
        : !sourceReady
            ? 'source_provenance_gap'
            : 'delivery_handoff_gap'
    const supportRecoveryNeeded = blockers.some(blocker => blocker.code === 'permission_denied')

    return {
        schemaVersion: 'dwm.webhook.alert_source_handoff_readiness_consumer.v1',
        consumesSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
        noNetwork: true,
        ready: state === 'ready_for_consumers',
        state,
        routeContract: {
            sourceHandoff: {
                method: 'GET' as const,
                route: '/v1/dwm/alerts',
                requiredQuery: ['organizationId', 'alertId'],
                expectedSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
                noNetwork: true,
            },
            supportHistory: {
                method: 'GET' as const,
                route: '/api/admin/support/inspect',
                requiredQuery: ['organizationId', 'targetUserId', 'requestId', 'action'],
                expectedSchemaVersion: 'organization.member_recovery_support_history_bridge.v1',
                noNetwork: true,
            },
        },
        org: {
            id: entry.orgId,
        },
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
            selectedCaptureIds: captureIds,
            provenanceCaptureIds: captureIds,
            provenanceSourceIds: sourceIds,
            provenanceGapCodes: sourceReady ? [] : ['missing_source_provenance'],
        },
        case: {
            id: entry.alert.caseId || null,
            path: entry.alert.casePath || null,
            routeUrl,
        },
        watchlist: {
            id: entry.watchlist.id,
            term: entry.watchlist.terms[0] || entry.watchlist.name || null,
            name: entry.watchlist.name,
        },
        webhookConsumer: {
            ready: deliveryReady,
            deliveryReady,
            delivered: entry.dedupe.alreadyDelivered || entry.status === 'sent',
            deliveryDedupeKey: dedupeKey,
            deliveryHistoryRefs: [entry.deliveryId].filter(Boolean),
            blockerCodes: blockers.map(blocker => blocker.code),
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                terminalFailure: entry.retry.terminalFailure,
            },
        },
        caseConsumer: {
            ready: Boolean(entry.alert.caseId || entry.alert.casePath),
            caseId: entry.alert.caseId || null,
            casePath: entry.alert.casePath || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            blockerCodes: [],
        },
        supportRecoveryBridge: {
            schemaVersion: 'organization.member_recovery_support_history_bridge.v1',
            required: supportRecoveryNeeded,
            source: 'support_audit_timeline',
            supportReceiptSchemas: [
                'support.access_recovery.execution_receipt.v1',
                'support.access_recovery.decision_receipt.v1',
                'support.action_execute.member_role_recovery.v1',
            ],
            expectedSupportActions: [
                'support.organization.access_recovery',
                'support.organization.access_recovery.approve',
                'support.organization.access_recovery.deny',
                'support.organization.member_role_recovery',
            ],
            replayFilters: {
                organizationId: entry.orgId,
                targetUserId: '<target_user_id>',
                requestId: entry.requestId,
                action: 'support.organization.access_recovery',
            },
            supportRoutes: {
                inspect: '/api/admin/support/inspect',
                accessRecovery: '/api/admin/support/access-recovery/:requestId',
                organization: '/api/admin/support/organizations/:id',
                memberRoleRecovery: '/api/admin/support/organizations/:id/members/:userId/role-recovery',
            },
            requiredAuditFields: ['organizationId', 'targetUserId', 'requestId', 'supportSessionId', 'reason', 'outcome'],
            noSilentMembershipMutation: true,
            nonmemberEnumeration: false,
        },
        orgDestinationReadinessBridge: {
            schemaVersion: 'organization.webhook_destination_readiness_bridge.v1',
            deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1',
            sourceContract: 'organization.watchlist_webhook_delivery_contract.v1',
            route: 'POST /v1/dwm/webhooks/deliver',
            noNetwork: true,
            ready: deliveryReady,
            defaultWebhookPolicy: 'manual_selection',
            canUseDefaultDestinations: false,
            selectedDestinationSource: entry.destinationId ? 'manual_selection' : 'manual_selection_required',
            requiredDestinationOrgId: entry.orgId,
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            ownerAdminManualTriggerRequired: true,
            memberManualTriggerAllowed: false,
            requiredAlertFields: [
                'alert.id',
                'alert.organizationId',
                'alert.tenantId',
                'alert.watchlistItemIds',
                'alert.workflowContext.alertGenerationRefs',
                'alert.workflowContext.alertGeneratorKeys',
            ],
            expectedDeliveryFields: [
                'organizationId',
                'tenantId',
                'destinationId',
                'eventType',
                'payload.alert.id',
                'payload.alert.organizationId',
                'payload.watchlist.watchlistItemIds',
                'delivery.idempotencyKey',
            ],
            selectedDestination: entry.destinationId
                ? {
                    id: entry.destinationId,
                    orgId: entry.orgId,
                    label: entry.destination.label,
                    type: entry.destination.type,
                    endpointHash: entry.destination.redactedEndpoint.endpointHash,
                    endpointExposed: false,
                    status: entry.destination.status,
                    enabled: entry.destination.enabled,
                }
                : null,
            skippedDestinationReasons: [
                'org_mismatch',
                'destination_disabled',
                'event_not_subscribed',
                'manual_selection_required',
                'webhook_policy_disabled',
            ],
            lifecycleBlockers: [
                'org_archived',
                'org_deleted',
                'watchlist_paused',
                'watchlist_archived',
                'member_revoked',
                'nonmember_denied',
            ],
            blockerCodes: blockers.map(blocker => blocker.code),
            nonmemberDestinationEnumeration: false,
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                terminalFailure: entry.retry.terminalFailure,
            },
            idempotency: {
                key: entry.deliveryProof.idempotencyKey,
                dedupeKey,
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        stableFields: [
            'sourceFamily',
            'selectedCaptureIds',
            'evidenceCount',
            'provenanceCaptureIds',
            'provenanceSourceIds',
            'webhookConsumer.deliveryDedupeKey',
            'webhookConsumer.retry.nextRetryAt',
            'caseConsumer.casePath',
            'orgDestinationReadinessBridge.selectedDestination.id',
        ],
        gapFields: [
            'state',
            'alert.provenanceGapCodes',
            'webhookConsumer.blockerCodes',
            'supportRecoveryBridge.required',
            'orgDestinationReadinessBridge.blockerCodes',
        ],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function buildDwmWebhookReceiptHistoryFilters({
    receipts,
    filters,
    access,
    liveDeliveryEnabled,
    blockers = [],
}: {
    receipts: Array<{
        deliveryId: string
        requestId: string
        orgId: string
        destinationId: string | null
        alertId: string
        eventType: DwmAlertEventType
        status: DwmWebhookDeliveryAttemptState
        rawStatus: string
        dryRun: boolean
        live: boolean
        replay: boolean
        dedupeKey: string | null
        casePath: string
        caseActionId?: string | null
        caseActionPath?: string | null
        alertUrl: string
        watchlist: { id: string, name: string, terms: string[] }
        destination: {
            label: string | null
            type: string | null
            status: string | null
            enabled: boolean | null
            redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
        }
        proof: {
            auditEventId: string | null
            auditAction: string | null
            payloadHash: string | null
            updatedAt: string | null
        }
        retry: {
            retryable: boolean
            nextRetryAt: string | null
            attemptCount: number
            lastErrorCategory: string | null
            terminalFailure: boolean
        }
        transitionReceipt: ReturnType<typeof buildDwmWebhookDeliveryTransitionReceipt>
        blockingCodes: string[]
    }>
    filters: {
        orgId?: string | null
        destinationId?: string | null
        alertId?: string | null
        casePath?: string | null
        caseActionId?: string | null
        caseActionPath?: string | null
        dedupeKey?: string | null
        requestId?: string | null
        idempotencyKey?: string | null
        action?: string | null
        status?: string | null
        timeFrom?: string | null
        timeTo?: string | null
        retryState?: string | null
        actorId?: string | null
    }
    access: { canRead: boolean, canRetry: boolean, memberSafe: boolean }
    liveDeliveryEnabled: boolean
    blockers?: ReturnType<typeof retryQueueBlocker>[]
}) {
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        caseActionId: clean(filters.caseActionId) || null,
        caseActionPath: clean(filters.caseActionPath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || null,
        idempotencyKey: clean(filters.idempotencyKey) || null,
        action: clean(filters.action) || null,
        status: clean(filters.status) || null,
        timeFrom: clean(filters.timeFrom) || null,
        timeTo: clean(filters.timeTo) || null,
        retryState: clean(filters.retryState) || null,
        actorId: clean(filters.actorId) || null,
    }
    const queryPreview = {
        orgId: normalizedFilters.orgId || '<org_id>',
        destinationId: normalizedFilters.destinationId || undefined,
        alertId: normalizedFilters.alertId || undefined,
        casePath: normalizedFilters.casePath || undefined,
        caseActionId: normalizedFilters.caseActionId || undefined,
        caseActionPath: normalizedFilters.caseActionPath || undefined,
        dedupeKey: normalizedFilters.dedupeKey || undefined,
        deliveryId: normalizedFilters.requestId || undefined,
        idempotencyKey: normalizedFilters.idempotencyKey || undefined,
        action: normalizedFilters.action || undefined,
        status: normalizedFilters.status || undefined,
        timeFrom: normalizedFilters.timeFrom || undefined,
        timeTo: normalizedFilters.timeTo || undefined,
        retryState: normalizedFilters.retryState || undefined,
        actorId: normalizedFilters.actorId || undefined,
    }
    const rows = receipts.map(receipt => ({
        schemaVersion: 'dwm.webhook.delivery_receipt_history_filter_row.v1',
        deliveryId: receipt.deliveryId,
        requestId: receipt.requestId,
        orgId: receipt.orgId,
        destinationId: receipt.destinationId,
        alertId: receipt.alertId,
        casePath: receipt.casePath,
        caseActionId: receipt.caseActionId || null,
        caseActionPath: receipt.caseActionPath || null,
        alertUrl: receipt.alertUrl,
        dedupeKey: receipt.dedupeKey,
        eventType: receipt.eventType,
        status: receipt.status,
        rawStatus: receipt.rawStatus,
        dryRun: receipt.dryRun,
        live: receipt.live,
        replay: receipt.replay,
        watchlistTerm: receipt.watchlist.terms[0] || receipt.watchlist.name || null,
        sourceFamily: receipt.transitionReceipt.alert.sourceFamily,
        provenanceIds: receipt.transitionReceipt.provenance,
        workflowStatus: receipt.transitionReceipt.workflow.status,
        routeUrl: receipt.transitionReceipt.workflow.routeUrl,
        auditEventId: receipt.proof.auditEventId,
        auditAction: receipt.proof.auditAction,
        auditEventIds: receipt.transitionReceipt.audit.auditEventIds,
        redactedTarget: receipt.transitionReceipt.redactedTarget,
        retry: {
            retryable: receipt.retry.retryable,
            nextRetryAt: receipt.retry.nextRetryAt,
            attemptCount: receipt.retry.attemptCount,
            lastErrorCategory: receipt.retry.lastErrorCategory,
            terminalFailure: receipt.retry.terminalFailure,
        },
        idempotency: {
            key: receipt.transitionReceipt.workflow.idempotencyKey,
            dedupeKey: receipt.transitionReceipt.workflow.dedupeKey,
            replay: receipt.replay,
        },
        queryKeys: {
            byDelivery: { orgId: receipt.orgId, deliveryId: receipt.deliveryId },
            byDestination: receipt.destinationId ? { orgId: receipt.orgId, destinationId: receipt.destinationId } : null,
            byAlert: receipt.alertId ? { orgId: receipt.orgId, alertId: receipt.alertId } : null,
            byCase: receipt.casePath ? { orgId: receipt.orgId, casePath: receipt.casePath } : null,
            byCaseAction: receipt.caseActionId || receipt.caseActionPath ? {
                orgId: receipt.orgId,
                ...(receipt.caseActionId ? { caseActionId: receipt.caseActionId } : {}),
                ...(receipt.caseActionPath ? { caseActionPath: receipt.caseActionPath } : {}),
            } : null,
            byDedupe: receipt.dedupeKey ? { orgId: receipt.orgId, dedupeKey: receipt.dedupeKey } : null,
        },
        blockers: receipt.transitionReceipt.denial.blockers,
        blockingCodes: receipt.transitionReceipt.denial.blockingCodes,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            payloadExposed: false,
        },
    }))
    const retryableRows = rows.filter(row => row.retry.retryable)
    const replayRows = rows.filter(row => row.replay)
    const missingDestinationRows = rows.filter(row => row.blockingCodes.includes('destination_unavailable'))
    const disabledRows = rows.filter(row => row.blockingCodes.includes('destination_disabled'))

    return {
        schemaVersion: 'dwm.webhook.delivery_receipt_history_filters.v1',
        noNetwork: true,
        liveDeliveryEnabled,
        externalSendEnabled: false,
        access,
        activeFilters: normalizedFilters,
        routeContract: {
            list: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'caseActionId', 'caseActionPath', 'dedupeKey', 'deliveryId', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId', 'replay'],
                noNetwork: true,
            },
            detail: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'deliveryId'],
                noNetwork: true,
            },
            replayHistory: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'dedupeKey'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'caseActionId', 'caseActionPath', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId'],
                noNetwork: true,
            },
            dryRunReplay: {
                method: 'POST',
                route: '/api/dwm/webhook-deliveries',
                requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                noNetworkDefault: true,
            },
        },
        queryPreview,
        queryPresets: {
            replayOnly: { ...queryPreview, replay: true },
            retryable: retryableRows[0]?.queryKeys.byDedupe || retryableRows[0]?.queryKeys.byDelivery || null,
            missingDestination: missingDestinationRows[0]?.queryKeys.byAlert || missingDestinationRows[0]?.queryKeys.byDelivery || null,
            disabledDestination: disabledRows[0]?.queryKeys.byDestination || disabledRows[0]?.queryKeys.byDelivery || null,
            latestReplay: replayRows[0]?.queryKeys.byDedupe || replayRows[0]?.queryKeys.byDelivery || null,
            latestCaseActionReplay: replayRows.find(row => row.queryKeys.byCaseAction)?.queryKeys.byCaseAction || null,
        },
        counts: {
            total: rows.length,
            replay: replayRows.length,
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            failed: rows.filter(row => row.status === 'failed').length,
            skipped: rows.filter(row => row.status === 'skipped').length,
            retryable: retryableRows.length,
            terminalFailure: rows.filter(row => row.retry.terminalFailure).length,
            missingDestination: missingDestinationRows.length,
            disabledDestination: disabledRows.length,
            auditLinked: rows.filter(row => Boolean(row.auditEventId)).length,
            blocked: rows.filter(row => row.blockingCodes.length > 0).length,
        },
        blockers: uniqueRetryQueueBlockers(blockers),
        rows,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            payloadExposed: false,
        },
    }
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

function dashboardLifecycleActionSummary(rows: Array<{
    destinationId: string
    lifecycleState: ReturnType<typeof destinationLifecycleState>
}>) {
    const dryRunRows = rows.filter(row => row.lifecycleState.requiredActions.dryRunTest)
    const enableRows = rows.filter(row => row.lifecycleState.requiredActions.enableDestination)
    const updateRows = rows.filter(row => row.lifecycleState.requiredActions.updateDestination)
    const ownerReviewRows = rows.filter(row => row.lifecycleState.revokedOwner)
    const actions = [
        dryRunRows.length
            ? {
                action: 'dry_run_test',
                count: dryRunRows.length,
                destinationIds: dryRunRows.map(row => row.destinationId),
                routeTemplate: 'POST /api/dwm/webhook-destinations/{destinationId}/test',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        enableRows.length
            ? {
                action: 'enable_destination',
                count: enableRows.length,
                destinationIds: enableRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                bodyPreview: { status: 'active' },
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        updateRows.length
            ? {
                action: 'review_destination_owner_or_secret',
                count: updateRows.length,
                destinationIds: updateRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        ownerReviewRows.length
            ? {
                action: 'review_revoked_owner',
                count: ownerReviewRows.length,
                destinationIds: ownerReviewRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
    ].filter(Boolean) as Array<Record<string, unknown>>

    return actions.map(action => ({
        ...action,
        redaction: {
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: false,
            safeForCustomerDisplay: true,
        },
    }))
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

function destinationCrudRouteContract() {
    return {
        schemaVersion: 'dwm.webhook.destination_crud_routes.v1',
        list: {
            method: 'GET',
            route: '/api/dwm/webhook-destinations',
            requiredQuery: ['orgId'],
            noNetwork: true,
        },
        create: {
            method: 'POST',
            route: '/api/dwm/webhook-destinations',
            requiredBody: ['orgId', 'endpointUrl'],
            optionalBody: ['name', 'label', 'type', 'kind', 'channel', 'events', 'requestId'],
            secretBodyFields: ['endpointUrl', 'webhookUrl', 'url'],
            noNetwork: true,
        },
        update: {
            method: 'PUT',
            route: '/api/dwm/webhook-destinations/:id',
            requiredBody: ['orgId'],
            optionalBody: ['name', 'label', 'endpointUrl', 'webhookUrl', 'url', 'type', 'kind', 'channel', 'events', 'status', 'requestId'],
            secretBodyFields: ['endpointUrl', 'webhookUrl', 'url'],
            noNetwork: true,
        },
        disable: {
            method: 'DELETE',
            route: '/api/dwm/webhook-destinations/:id',
            requiredQuery: ['orgId'],
            noNetwork: true,
        },
        enable: {
            method: 'PUT',
            route: '/api/dwm/webhook-destinations/:id',
            requiredBody: ['orgId', 'status'],
            optionalBody: ['requestId'],
            noNetwork: true,
        },
        test: {
            method: 'POST',
            route: '/api/dwm/webhook-destinations/:id/test',
            requiredBody: ['orgId', 'dryRun'],
            optionalBody: ['alert', 'eventType', 'dedupeKey', 'casePath', 'requestId'],
            noNetworkDefault: true,
        },
    }
}

function destinationCrudManagementRequest({
    action,
    orgId,
    destinationId,
    requestId,
    label,
    kind,
    channel,
    status,
    events,
    redactedEndpoint,
    blockers,
    canApply,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destinationId: string | null
    requestId: string
    label: string
    kind: DwmWebhookKind
    channel: string | null
    status: DwmWebhookStatus
    events: DwmAlertEventType[]
    redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    blockers: ReturnType<typeof crudBlocker>[]
    canApply: boolean
    liveDeliveryEnabled: boolean
}) {
    const route = action === 'create'
        ? '/api/dwm/webhook-destinations'
        : action === 'test'
            ? `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}/test`
            : `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}`
    const method = action === 'create' || action === 'test'
        ? 'POST'
        : action === 'disable' || action === 'delete'
            ? 'DELETE'
            : 'PUT'
    const expectedAuditAction = action === 'create'
        ? 'destination.created'
        : action === 'disable' || action === 'delete'
            ? 'destination.archived'
            : action === 'test'
                ? 'delivery.tested'
                : 'destination.updated'
    const bodyPreview = method === 'DELETE'
        ? null
        : {
            orgId,
            destinationId,
            requestId: requestId || null,
            label,
            type: kind,
            kind,
            channel,
            status,
            events,
            dryRun: action === 'test' ? true : undefined,
            redactedEndpoint: {
                endpointHint: redactedEndpoint.endpointHint,
                endpointHash: redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            secretFields: action === 'create' || action === 'update' ? ['endpointUrl', 'webhookUrl', 'url'] : [],
        }

    return {
        schemaVersion: 'dwm.webhook.destination_management_request.v1',
        action,
        method,
        route,
        noNetwork: true,
        liveDeliveryEnabled,
        canSend: canApply,
        expectedAuditAction,
        expectedPersistedAttempt: action === 'test',
        bodyPreview,
        queryPreview: method === 'DELETE' ? { orgId, requestId: requestId || null } : null,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        blockers,
        blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
    }
}

function destinationCrudPersistenceReceipt({
    action,
    orgId,
    destination,
    desired,
    managementRequest,
    blockers,
    proofRow,
    duplicateDestinationId,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destination: DwmWebhookDestinationPublic | null
    desired: {
        label: string
        type: DwmWebhookKind
        kind: DwmWebhookKind
        channel: string | null
        status: DwmWebhookStatus
        events: DwmAlertEventType[]
        redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    }
    managementRequest: ReturnType<typeof destinationCrudManagementRequest>
    blockers: ReturnType<typeof crudBlocker>[]
    proofRow: ReturnType<typeof buildDwmWebhookDestinationAdminProof>['destinations'][number] | null
    duplicateDestinationId: string | null
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const currentStatus = destination?.status || null
    const nextStatus = action === 'delete'
        ? 'archived'
        : action === 'disable'
            ? 'paused'
            : action === 'enable'
                ? 'active'
                : desired.status
    const persisted = blockingCodes.length === 0
    const destinationId = destination?.id || null
    const redactedEndpoint = {
        endpointHint: desired.redactedEndpoint.endpointHint || (destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null),
        endpointHash: desired.redactedEndpoint.endpointHash || destination?.endpointHash || null,
        endpointExposed: false,
    }

    return {
        schemaVersion: 'dwm.webhook.destination_persistence_receipt.v1',
        action,
        org: { id: orgId },
        destinationId,
        redactedTarget: {
            destinationId,
            label: destination?.name || desired.label,
            type: destination?.kind || desired.kind,
            currentStatus,
            nextStatus,
            endpoint: redactedEndpoint,
        },
        mutation: {
            operation: action,
            persisted,
            stateChanged: Boolean(currentStatus && currentStatus !== nextStatus),
            currentStatus,
            nextStatus,
            enabledAfter: nextStatus === 'active',
            displayLabel: desired.label,
            channelLabel: desired.channel,
            events: desired.events,
        },
        request: {
            method: managementRequest.method,
            route: managementRequest.route,
            noNetwork: true,
            liveDeliveryEnabled,
            canSend: managementRequest.canSend,
            bodyPreview: managementRequest.bodyPreview,
            queryPreview: managementRequest.queryPreview,
        },
        dryRun: {
            requiredBeforeLive: true,
            testRoute: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/<destination_id>/test',
            latestTestStatus: proofRow?.lifecycle.lastTest.status || null,
            latestTestRequestId: proofRow?.lifecycle.lastTest.requestId || null,
            latestTestAuditEventId: proofRow?.lifecycle.lastTest.auditEventId || null,
        },
        deliveryContext: {
            alertId: null,
            caseId: null,
            casePath: null,
            watchlistTerm: null,
            sourceFamily: null,
            provenanceIds: { captureIds: [], sourceIds: [], primaryCaptureId: null },
            workflowStatus: 'destination_mutation',
            routeUrl: managementRequest.route,
            appliesToAlertDelivery: false,
        },
        audit: {
            expectedAction: managementRequest.expectedAuditAction,
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateDestinationId,
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
        },
        denial: {
            denied: blockingCodes.length > 0,
            blockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        noNetwork: true,
        externalSendEnabled: false,
    }
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
