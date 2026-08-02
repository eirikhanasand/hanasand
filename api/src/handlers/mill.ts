import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { recordAdminAuditEvent } from '#utils/adminAudit.ts'

type MillEvent = Record<string, unknown>
type MillBody = { source?: Record<string, unknown>, events?: unknown }

export async function ingestMill(req: FastifyRequest, res: FastifyReply) {
    const secret = bearer(req)
    const key = secret ? await validateApiKey(secret) : null
    if (!key?.organizationId || !matchApiKeyScope(key.apiKey.scopes, 'POST', '/mill')) {
        return res.status(401).send({ error: { code: 'mill_authentication_required', message: 'Use an active organization API key with Mill ingestion access.' } })
    }

    const body = req.body as MillBody | undefined
    const events = Array.isArray(body?.events) ? body.events : body && typeof body === 'object' && !Array.isArray(body) ? [body] : []
    if (!events.length || events.some(event => !event || typeof event !== 'object' || Array.isArray(event))) {
        return res.status(400).send({ error: { code: 'invalid_mill_payload', message: 'Send one JSON event or an events array containing JSON objects.' } })
    }
    if (events.length > 500) {
        return res.status(413).send({ error: { code: 'mill_batch_too_large', message: 'Mill accepts at most 500 events per request.' } })
    }

    const source = body?.source && typeof body.source === 'object' && !Array.isArray(body.source) ? body.source : {}
    const ingestionId = `mill_${randomUUID()}`
    const accepted: string[] = []
    for (const event of events as MillEvent[]) {
        const normalized = normalizeEvent(event, source)
        const eventId = randomUUID()
        await run(`
            INSERT INTO mill_events (
                id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
                event_type, action, outcome, user_id, user_email, source_ip, source_country,
                source_city, device_id, normalized, original, processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'processed')
        `, [
            eventId, ingestionId, key.organizationId, normalized.sourceVendor, normalized.sourceProduct,
            normalized.timestamp, normalized.eventType, normalized.action, normalized.outcome,
            normalized.userId, normalized.userEmail, normalized.sourceIp, normalized.sourceCountry,
            normalized.sourceCity, normalized.deviceId, JSON.stringify(normalized.normalized), JSON.stringify(normalized.original),
        ])
        accepted.push(eventId)
        await createMillFindings(key.organizationId, eventId, normalized)
    }

    return res.status(202).send({ accepted: true, ingestion_id: ingestionId, accepted_events: accepted.length, rejected_events: 0 })
}

export async function getMillEvents(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string, limit?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const result = await run(`
        SELECT id, ingestion_id, source_vendor, source_product, event_timestamp, received_at,
               event_type, action, outcome, user_id, user_email, source_ip, source_country,
               source_city, device_id, normalized, original, processing_status
        FROM mill_events
        WHERE organization_id = $1
        ORDER BY event_timestamp DESC, received_at DESC
        LIMIT $2
    `, [access.organizationId, limit])
    return res.send({ organizationId: access.organizationId, events: result.rows })
}

export async function getMillFindings(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string, limit?: string, status?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const result = await run(`
        SELECT id, rule_id, severity, status, summary, evidence, event_ids,
               first_observed, last_observed, assignee_id, analyst_note, created_at, updated_at
        FROM mill_findings
        WHERE organization_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 last_observed DESC
        LIMIT $3
    `, [access.organizationId, query.status || null, limit])
    return res.send({ organizationId: access.organizationId, findings: result.rows })
}

export async function postMillFindingAction(req: FastifyRequest<{ Params: { id: string }, Body: { status?: unknown, note?: unknown, assigneeId?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const body = req.body || {}
    const statuses = ['new', 'investigating', 'benign', 'resolved', 'suppressed']
    const status = typeof body.status === 'string' && statuses.includes(body.status) ? body.status : null
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 4000) : null
    const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId.trim() || null : null
    if (!status && note === null && body.assigneeId === undefined) return res.status(400).send({ error: 'Provide a valid status, note, or assigneeId.' })
    const result = await run(`
        UPDATE mill_findings
        SET status = COALESCE($3, status), analyst_note = COALESCE($4, analyst_note), assignee_id = COALESCE($5, assignee_id), updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, status, analyst_note, assignee_id, updated_at
    `, [req.params.id, access.organizationId, status, note, assigneeId])
    if (!result.rows[0]) return res.status(404).send({ error: 'Finding not found.' })
    await recordAdminAuditEvent(req, {
        actionType: 'mill.finding.updated',
        actorId: access.userId,
        organizationId: access.organizationId,
        targetType: 'mill_finding',
        targetId: req.params.id,
        context: { status, noteProvided: note !== null, assigneeId },
    })
    return res.send({ finding: result.rows[0] })
}

async function organizationAccess(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    const query = req.query as { organizationId?: string }
    const organizationId = query.organizationId || (req.params as { organizationId?: string }).organizationId || ''
    if (!organizationId) {
        res.status(400).send({ error: 'organizationId is required.' })
        return null
    }
    const result = await run(`
        SELECT o.id
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2 AND om.status = 'active'
        WHERE o.id = $1 AND o.status = 'active'
    `, [organizationId, userId])
    if (!result.rows[0]) {
        res.status(403).send({ error: 'Organization access denied.' })
        return null
    }
    return { organizationId, userId }
}

async function createMillFindings(organizationId: string, eventId: string, event: NormalizedEvent) {
    if (event.eventType !== 'authentication' || event.action !== 'login' || !event.userId) return
    const previous = await run(`
        SELECT id, event_timestamp, outcome, source_country, normalized
        FROM mill_events
        WHERE organization_id = $1 AND user_id = $2 AND id <> $3
        ORDER BY event_timestamp DESC
        LIMIT 30
    `, [organizationId, event.userId, eventId])
    const rows = previous.rows as Array<{ id: string, event_timestamp: string, outcome: string, source_country: string | null, normalized: MillEvent }>
    const failures = rows.filter(row => row.outcome === 'failure' && Date.parse(event.timestamp) - Date.parse(row.event_timestamp) <= 15 * 60_000)
    if (event.outcome === 'success' && failures.length >= 3) {
        await insertFinding(organizationId, 'auth.brute_force_success.v1', 'high', 'Successful login after repeated failures', [eventId, ...failures.slice(0, 5).map(row => row.id)], { successfulEventId: eventId, failedEventIds: failures.slice(0, 5).map(row => row.id) })
    }
    if (event.outcome !== 'success') return
    const priorSuccess = rows.find(row => row.outcome === 'success' && row.source_country && event.sourceCountry && row.source_country !== event.sourceCountry)
    if (priorSuccess) {
        await insertFinding(organizationId, 'auth.new_country.v1', 'medium', `Login from new country: ${event.sourceCountry}`, [eventId, priorSuccess.id], { currentCountry: event.sourceCountry, previousCountry: priorSuccess.source_country })
    }
    const coordinates = coordinatesFor(event.normalized)
    const priorCoordinates = rows.map(row => ({ row, coordinates: coordinatesFor(row.normalized) })).find(item => item.row.outcome === 'success' && item.coordinates && coordinates)
    if (priorCoordinates && coordinates) {
        const minutes = Math.abs(Date.parse(event.timestamp) - Date.parse(priorCoordinates.row.event_timestamp)) / 60_000
        const distanceKm = distance(coordinates, priorCoordinates.coordinates!)
        if (minutes < 12 * 60 && distanceKm > 500) {
            await insertFinding(organizationId, 'auth.impossible_travel.v1', 'high', 'Successful logins from geographically incompatible locations', [eventId, priorCoordinates.row.id], { current: coordinates, previous: priorCoordinates.coordinates, distanceKm: Math.round(distanceKm), elapsedMinutes: Math.round(minutes) })
        }
    }
}

async function insertFinding(organizationId: string, ruleId: string, severity: string, summary: string, eventIds: string[], evidence: MillEvent) {
    const findingKey = `${organizationId}:${ruleId}:${eventIds.slice().sort().join(',')}`
    await run(`
        INSERT INTO mill_findings (id, organization_id, finding_key, rule_id, severity, status, summary, evidence, event_ids, first_observed, last_observed)
        VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, NOW(), NOW())
        ON CONFLICT (finding_key) DO NOTHING
    `, [randomUUID(), organizationId, findingKey, ruleId, severity, summary, JSON.stringify(evidence), eventIds])
}

type NormalizedEvent = {
    timestamp: string
    eventType: string
    action: string
    outcome: string
    userId: string | null
    userEmail: string | null
    sourceIp: string | null
    sourceCountry: string | null
    sourceCity: string | null
    deviceId: string | null
    sourceVendor: string
    sourceProduct: string
    normalized: MillEvent
    original: MillEvent
}

function normalizeEvent(event: MillEvent, source: Record<string, unknown>): NormalizedEvent {
    const user = object(event.user)
    const sourceContext = object(event.source)
    const timestamp = typeof event.timestamp === 'string' && !Number.isNaN(Date.parse(event.timestamp)) ? new Date(event.timestamp).toISOString() : new Date().toISOString()
    return {
        timestamp,
        eventType: stringValue(event.event_type || event.category) || 'unknown',
        action: stringValue(event.action) || 'unknown',
        outcome: stringValue(event.outcome || event.result) || 'unknown',
        userId: stringValue(user.id || event.user_id),
        userEmail: stringValue(user.email || event.user_email),
        sourceIp: stringValue(sourceContext.ip || event.source_ip),
        sourceCountry: stringValue(sourceContext.country || event.country),
        sourceCity: stringValue(sourceContext.city || event.city),
        deviceId: stringValue(object(event.device).id || event.device_id),
        sourceVendor: stringValue(source.vendor) || 'custom',
        sourceProduct: stringValue(source.product) || 'generic-json',
        normalized: redact({ ...event, timestamp }),
        original: redact(event),
    }
}

function object(value: unknown): MillEvent { return value && typeof value === 'object' && !Array.isArray(value) ? value as MillEvent : {} }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function bearer(req: FastifyRequest) { const value = req.headers.authorization; return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : '' }
function redact(value: unknown): MillEvent {
    if (Array.isArray(value)) return value.map(redact) as unknown as MillEvent
    if (!value || typeof value !== 'object') return value as MillEvent
    return Object.fromEntries(Object.entries(value).map(([key, child]) => /password|token|secret|cookie|authorization/i.test(key) ? [key, '[REDACTED]'] : [key, redact(child)]))
}
function coordinatesFor(event: MillEvent) {
    const source = object(event.source)
    const coordinates = object(source.coordinates)
    const lat = Number(coordinates.latitude ?? source.latitude)
    const lon = Number(coordinates.longitude ?? source.longitude)
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}
function distance(a: { lat: number, lon: number }, b: { lat: number, lon: number }) {
    const radius = 6371
    const radians = (value: number) => value * Math.PI / 180
    const dLat = radians(b.lat - a.lat)
    const dLon = radians(b.lon - a.lon)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
    return 2 * radius * Math.asin(Math.sqrt(h))
}
