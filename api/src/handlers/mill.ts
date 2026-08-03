import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { recordAdminAuditEvent } from '#utils/adminAudit.ts'

type MillEvent = Record<string, unknown>
type MillBody = { source?: Record<string, unknown>, events?: unknown }
type MillCondition = { path: string, operator: 'equals' | 'contains' | 'regex', value: string }
type MillRule = { id: string, recordId?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: { match: 'all', conditions: MillCondition[] } }

export const MILL_RULES: MillRule[] = [
    { id: 'auth.brute_force_success.v1', version: '1', name: 'Brute-force success', family: 'Authentication', severity: 'high', explanation: 'A successful login followed multiple failed logins for the same user within 15 minutes.', evidence: ['failed event IDs', 'successful event ID', 'time window'] },
    { id: 'auth.password_spray.v1', version: '1', name: 'Password spray', family: 'Authentication', severity: 'high', explanation: 'One source IP produced failed logins for multiple users within 15 minutes.', evidence: ['source IP', 'target user IDs', 'failed event IDs', 'time window'] },
    { id: 'auth.impossible_travel.v1', version: '1', name: 'Impossible travel', family: 'Authentication', severity: 'high', explanation: 'Successful logins for one user occurred more than 500 km apart within 12 hours, with coordinates present in both events.', evidence: ['coordinates', 'distance', 'elapsed time', 'related event IDs'] },
    { id: 'auth.new_country.v1', version: '1', name: 'New country', family: 'Authentication', severity: 'medium', explanation: 'A successful login came from a country not seen in the user’s recent successful login history.', evidence: ['current country', 'previous country', 'related event IDs'] },
    { id: 'auth.new_device.v1', version: '1', name: 'New device', family: 'Authentication', severity: 'medium', explanation: 'A successful login used a device identifier not seen in the user’s recent successful login history.', evidence: ['current device', 'previous device', 'related event IDs'] },
]

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
    const invalidFields = validateMillEventFields(events as MillEvent[])
    if (invalidFields.length) {
        return res.status(400).send({ error: { code: 'invalid_mill_event_fields', message: 'Correct the invalid event fields and try again.', fields: invalidFields } })
    }

    const source = body?.source && typeof body.source === 'object' && !Array.isArray(body.source) ? body.source : {}
    const ingestionId = `mill_${randomUUID()}`
    const configuredRules = await loadConfiguredMillRules(key.organizationId)
    const accepted: string[] = []
    for (const event of events as MillEvent[]) {
        const normalized = normalizeEvent(event, source)
        const eventId = randomUUID()
        await run(`
            INSERT INTO mill_events (
                id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
                event_type, action, outcome, user_id, user_email, source_ip, source_country,
                source_city, device_id, normalized, original, parser_version, processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'mill.v1', 'processed')
        `, [
            eventId, ingestionId, key.organizationId, normalized.sourceVendor, normalized.sourceProduct,
            normalized.timestamp, normalized.eventType, normalized.action, normalized.outcome,
            normalized.userId, normalized.userEmail, normalized.sourceIp, normalized.sourceCountry,
            normalized.sourceCity, normalized.deviceId, JSON.stringify(normalized.normalized), JSON.stringify(normalized.original),
        ])
        accepted.push(eventId)
        await createMillFindings(key.organizationId, eventId, normalized, configuredRules)
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
               source_city, device_id, normalized, original, parser_version, processing_status
        FROM mill_events
        WHERE organization_id = $1
        ORDER BY event_timestamp DESC, received_at DESC
        LIMIT $2
    `, [access.organizationId, limit])
    return res.send({ organizationId: access.organizationId, events: result.rows })
}

export async function getMillRules(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    return res.send({ organizationId: access.organizationId, rules: await loadConfiguredMillRules(access.organizationId) })
}

export async function postMillRule(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Owner or admin access is required to manage Mill rules.' })
    const body = req.body as { name?: unknown, explanation?: unknown, severity?: unknown, conditions?: unknown } | undefined
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const explanation = typeof body?.explanation === 'string' ? body.explanation.trim() : ''
    const severity = typeof body?.severity === 'string' && ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity : 'medium'
    const conditionResult = normalizeMillConditions(body?.conditions)
    if (name.length < 2 || name.length > 120) return res.status(400).send({ error: 'Rule name must contain 2-120 characters.' })
    if (explanation.length < 10 || explanation.length > 500) return res.status(400).send({ error: 'Rule explanation must contain 10-500 characters.' })
    if (!conditionResult.conditions.length || conditionResult.error) return res.status(400).send({ error: conditionResult.error || 'Add at least one valid rule condition.' })
    const ruleId = `custom.${randomUUID().replaceAll('-', '').slice(0, 20)}.v1`
    const result = await run(`
        INSERT INTO mill_rules (id, organization_id, rule_id, version, name, family, severity, explanation, definition, enabled, created_by)
        VALUES ($1, $2, $3, '1', $4, 'Custom', $5, $6, $7, TRUE, $8)
        RETURNING id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, created_at, updated_at
    `, [randomUUID(), access.organizationId, ruleId, name, severity, explanation, JSON.stringify({ match: 'all', conditions: conditionResult.conditions }), access.userId])
    await recordAdminAuditEvent(req, { actionType: 'mill.rule.created', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_rule', targetId: result.rows[0].id, context: { ruleId, severity, conditionCount: conditionResult.conditions.length } })
    return res.status(201).send({ rule: { ...result.rows[0], source: 'owned' } })
}

export async function postMillRulePack(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Owner or admin access is required to import Mill rules.' })
    const body = req.body as { packName?: unknown, packVersion?: unknown, sourceReference?: unknown, rules?: unknown } | undefined
    const packName = typeof body?.packName === 'string' ? body.packName.trim() : ''
    const packVersion = typeof body?.packVersion === 'string' ? body.packVersion.trim() : ''
    const sourceReference = typeof body?.sourceReference === 'string' ? body.sourceReference.trim() : ''
    if (packName.length < 2 || packName.length > 100 || packVersion.length < 1 || packVersion.length > 40) return res.status(400).send({ error: 'Pack name must contain 2-100 characters and version 1-40 characters.' })
    let parsedReference: URL
    try { parsedReference = new URL(sourceReference) } catch { return res.status(400).send({ error: 'Open-source pack reference must be an HTTPS URL of at most 300 characters.' }) }
    if (parsedReference.protocol !== 'https:' || !parsedReference.hostname || sourceReference.length > 300) return res.status(400).send({ error: 'Open-source pack reference must be an HTTPS URL of at most 300 characters.' })
    if (!Array.isArray(body?.rules) || body.rules.length < 1 || body.rules.length > 100) return res.status(400).send({ error: 'Import 1-100 rules per pack.' })
    const packSlug = packName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
    if (!packSlug) return res.status(400).send({ error: 'Pack name must contain letters or numbers.' })
    const prepared: Array<{ ruleId: string, name: string, severity: string, explanation: string, definition: { match: 'all', conditions: MillCondition[] } }> = []
    for (const item of body.rules) {
        const rule = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
        const rawId = typeof rule.id === 'string' ? rule.id.trim() : ''
        const name = typeof (rule.name ?? rule.title) === 'string' ? String(rule.name ?? rule.title).trim() : ''
        const explanation = typeof (rule.explanation ?? rule.description) === 'string' ? String(rule.explanation ?? rule.description).trim() : ''
        const severity = typeof (rule.severity ?? rule.level) === 'string' && ['low', 'medium', 'high', 'critical'].includes(String(rule.severity ?? rule.level)) ? String(rule.severity ?? rule.level) : 'medium'
        const conditions = normalizeMillConditions(rule.conditions)
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(rawId) || name.length < 2 || name.length > 120 || explanation.length < 10 || explanation.length > 500 || conditions.error || !conditions.conditions.length) return res.status(400).send({ error: `Invalid imported rule: ${rawId || 'missing id'}.`, detail: conditions.error || 'Rule needs valid conditions.' })
        prepared.push({ ruleId: `open.${packSlug}.${rawId}.v1`, name, severity, explanation, definition: { match: 'all', conditions: conditions.conditions } })
    }
    for (const rule of prepared) {
        await run(`
            INSERT INTO mill_rules (id, organization_id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, created_by)
            VALUES ($1, $2, $3, '1', $4, $5, $6, $7, $8, 'open_source', $9, TRUE, $10)
            ON CONFLICT (organization_id, rule_id) DO UPDATE SET version = EXCLUDED.version, name = EXCLUDED.name, family = EXCLUDED.family, severity = EXCLUDED.severity, explanation = EXCLUDED.explanation, definition = EXCLUDED.definition, source = EXCLUDED.source, source_reference = EXCLUDED.source_reference, updated_at = NOW()
        `, [randomUUID(), access.organizationId, rule.ruleId, rule.name, packName, rule.severity, rule.explanation, JSON.stringify(rule.definition), sourceReference, access.userId])
    }
    await recordAdminAuditEvent(req, { actionType: 'mill.rule_pack.imported', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_rule_pack', targetId: `${packSlug}@${packVersion}`, context: { packName, packVersion, sourceReference, ruleCount: prepared.length } })
    return res.status(201).send({ imported: prepared.length, pack: { name: packName, version: packVersion, sourceReference } })
}

export async function postMillRuleAction(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string }, Body: { action?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Owner or admin access is required to manage Mill rules.' })
    const action = req.body?.action === 'enable' || req.body?.action === 'disable' ? req.body.action : null
    if (!action) return res.status(400).send({ error: 'Action must be enable or disable.' })
    const builtIn = MILL_RULES.find(rule => rule.id === req.params.id)
    if (builtIn) {
        const result = await run(`
            INSERT INTO mill_rules (id, organization_id, rule_id, version, name, family, severity, explanation, definition, source, enabled, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, 'hanasand', $9, $10)
            ON CONFLICT (organization_id, rule_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
            RETURNING id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, updated_at
        `, [randomUUID(), access.organizationId, builtIn.id, builtIn.version, builtIn.name, builtIn.family, builtIn.severity, builtIn.explanation, action === 'enable', access.userId])
        await recordAdminAuditEvent(req, { actionType: 'mill.rule.updated', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_rule', targetId: result.rows[0].id, context: { action, ruleId: builtIn.id } })
        return res.send({ rule: { ...result.rows[0], id: builtIn.id, source: 'hanasand' } })
    }
    const result = await run(`
        UPDATE mill_rules
        SET enabled = $3, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, updated_at
    `, [req.params.id, access.organizationId, action === 'enable'])
    if (!result.rows[0]) return res.status(404).send({ error: 'Custom Mill rule not found.' })
    await recordAdminAuditEvent(req, { actionType: 'mill.rule.updated', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_rule', targetId: req.params.id, context: { action } })
    return res.send({ rule: { ...result.rows[0], source: result.rows[0].source || 'owned' } })
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
        SELECT o.id, om.role
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2 AND om.status = 'active'
        WHERE o.id = $1 AND o.status = 'active'
    `, [organizationId, userId])
    if (!result.rows[0]) {
        res.status(403).send({ error: 'Organization access denied.' })
        return null
    }
    return { organizationId, userId, role: result.rows[0].role as string }
}

async function loadConfiguredMillRules(organizationId: string): Promise<MillRule[]> {
    const result = await run(`
        SELECT id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled
        FROM mill_rules
        WHERE organization_id = $1
        ORDER BY created_at ASC
    `, [organizationId])
    const overrides = new Map((result.rows as Array<Record<string, unknown>>).map(row => [String(row.rule_id), row]))
    const builtIns = MILL_RULES.map(rule => {
        const override = overrides.get(rule.id)
        return { ...rule, enabled: override ? Boolean(override.enabled) : true, source: 'hanasand' as const }
    })
    const custom = (result.rows as Array<Record<string, unknown>>)
        .filter(row => !MILL_RULES.some(rule => rule.id === row.rule_id))
        .map(row => ({
            id: String(row.rule_id), recordId: String(row.id), version: String(row.version), name: String(row.name), family: String(row.family), severity: String(row.severity), explanation: String(row.explanation), evidence: millConditionEvidence(row.definition), enabled: Boolean(row.enabled), source: (row.source === 'open_source' ? 'open_source' : 'owned') as 'open_source' | 'owned', sourceReference: typeof row.source_reference === 'string' ? row.source_reference : undefined, definition: row.definition as MillRule['definition'],
        }))
    return [...builtIns, ...custom]
}

async function createMillFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: MillRule[]) {
    const enabled = new Set(rules.filter(rule => rule.enabled !== false).map(rule => rule.id))
    for (const rule of rules.filter(rule => (rule.source === 'owned' || rule.source === 'open_source') && rule.enabled !== false)) {
        if (rule.definition && matchesMillRule(event.normalized, rule.definition.conditions)) {
            await insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { ruleId: rule.id, matchedConditions: rule.definition.conditions, eventId })
        }
    }
    if (event.eventType !== 'authentication' || event.action !== 'login') return
    const previous = await run(`
        SELECT id, event_timestamp, outcome, source_country, normalized
        FROM mill_events
        WHERE organization_id = $1 AND user_id = $2 AND id <> $3
        ORDER BY event_timestamp DESC
        LIMIT 30
    `, [organizationId, event.userId, eventId])
    const rows = previous.rows as Array<{ id: string, event_timestamp: string, outcome: string, source_country: string | null, normalized: MillEvent }>
    if (enabled.has('auth.password_spray.v1') && event.outcome === 'failure' && event.sourceIp) {
        const spray = await run(`
            SELECT id, user_id, event_timestamp
            FROM mill_events
            WHERE organization_id = $1 AND source_ip = $2 AND outcome = 'failure' AND id <> $3
              AND event_timestamp BETWEEN ($4::timestamptz - INTERVAL '15 minutes') AND $4::timestamptz
            ORDER BY event_timestamp DESC
            LIMIT 100
        `, [organizationId, event.sourceIp, eventId, event.timestamp])
        const sprayRows = spray.rows as Array<{ id: string, user_id: string | null }>
        const targetUsers = Array.from(new Set([event.userId, ...sprayRows.map(row => row.user_id)].filter(Boolean)))
        if (targetUsers.length >= 3) {
            await insertFinding(organizationId, 'auth.password_spray.v1', 'high', 'Failed logins for multiple users from one source', [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], { sourceIp: event.sourceIp, userIds: targetUsers, failedEventIds: [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], windowMinutes: 15 })
        }
    }
    if (!event.userId) return
    const failures = rows.filter(row => {
        const elapsed = Date.parse(event.timestamp) - Date.parse(row.event_timestamp)
        return row.outcome === 'failure' && elapsed >= 0 && elapsed <= 15 * 60_000
    })
    if (enabled.has('auth.brute_force_success.v1') && event.outcome === 'success' && failures.length >= 3) {
        await insertFinding(organizationId, 'auth.brute_force_success.v1', 'high', 'Successful login after repeated failures', [eventId, ...failures.slice(0, 5).map(row => row.id)], { successfulEventId: eventId, failedEventIds: failures.slice(0, 5).map(row => row.id) })
    }
    if (event.outcome !== 'success') return
    const priorSuccess = rows.find(row => row.outcome === 'success' && row.source_country && event.sourceCountry && row.source_country !== event.sourceCountry)
    if (enabled.has('auth.new_country.v1') && priorSuccess) {
        await insertFinding(organizationId, 'auth.new_country.v1', 'medium', `Login from new country: ${event.sourceCountry}`, [eventId, priorSuccess.id], { currentCountry: event.sourceCountry, previousCountry: priorSuccess.source_country })
    }
    const currentDevice = event.deviceId
    const priorDevice = currentDevice && rows.find(row => row.outcome === 'success' && deviceIdFor(row.normalized) && deviceIdFor(row.normalized) !== currentDevice)
    if (enabled.has('auth.new_device.v1') && priorDevice) {
        await insertFinding(organizationId, 'auth.new_device.v1', 'medium', 'Successful login from a new device', [eventId, priorDevice.id], { currentDevice, previousDevice: deviceIdFor(priorDevice.normalized) })
    }
    const coordinates = coordinatesFor(event.normalized)
    const priorCoordinates = rows.map(row => ({ row, coordinates: coordinatesFor(row.normalized) })).find(item => item.row.outcome === 'success' && item.coordinates && coordinates)
    if (enabled.has('auth.impossible_travel.v1') && priorCoordinates && coordinates) {
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

export function validateMillEventFields(events: MillEvent[]) {
    return events.flatMap((event, index) => {
        if (event.timestamp === undefined) return []
        if (typeof event.timestamp !== 'string' || Number.isNaN(Date.parse(event.timestamp))) {
            return [{ field: `events[${index}].timestamp`, message: 'timestamp must be a valid ISO-8601 date string.' }]
        }
        return []
    })
}

function object(value: unknown): MillEvent { return value && typeof value === 'object' && !Array.isArray(value) ? value as MillEvent : {} }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function canManageMillRules(role: string) { return role === 'owner' || role === 'admin' }
function deviceIdFor(event: MillEvent) { return stringValue(object(event.device).id || event.device_id) }
export function normalizeMillConditions(value: unknown): { conditions: MillCondition[], error?: string } {
    if (!Array.isArray(value) || value.length < 1 || value.length > 8) return { conditions: [], error: 'Conditions must contain 1-8 items.' }
    const conditions: MillCondition[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { conditions: [], error: 'Each condition must be an object.' }
        const condition = item as Record<string, unknown>
        const path = typeof condition.path === 'string' ? condition.path.trim() : ''
        const operator = condition.operator
        const conditionValue = typeof condition.value === 'string' ? condition.value : ''
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(path)) return { conditions: [], error: 'Condition paths may contain only letters, numbers, dots, hyphens, and underscores.' }
        if (operator !== 'equals' && operator !== 'contains' && operator !== 'regex') return { conditions: [], error: 'Condition operators must be equals, contains, or regex.' }
        if (!conditionValue || conditionValue.length > 200) return { conditions: [], error: 'Condition values must contain 1-200 characters.' }
        if (operator === 'regex') {
            try { new RegExp(conditionValue) } catch { return { conditions: [], error: 'Regex condition is invalid.' } }
        }
        conditions.push({ path, operator, value: conditionValue })
    }
    return { conditions }
}
function millConditionEvidence(value: unknown) {
    const conditions = (value as { conditions?: unknown })?.conditions
    return Array.isArray(conditions) ? conditions.map(condition => typeof condition === 'object' && condition && 'path' in condition ? String(condition.path) : 'condition') : []
}
export function matchesMillRule(event: MillEvent, conditions: MillCondition[]) {
    return conditions.every(condition => {
        const value = getMillPath(event, condition.path)
        if (value === undefined || value === null || typeof value === 'object') return false
        const actual = String(value)
        if (condition.operator === 'equals') return actual.toLowerCase() === condition.value.toLowerCase()
        if (condition.operator === 'contains') return actual.toLowerCase().includes(condition.value.toLowerCase())
        try { return new RegExp(condition.value, 'i').test(actual) } catch { return false }
    })
}
function getMillPath(value: MillEvent, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' && !Array.isArray(current) ? (current as MillEvent)[part] : undefined, value)
}
function bearer(req: FastifyRequest) {
    const apiKey = req.headers['x-api-key']
    if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim()
    const value = req.headers.authorization
    return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}
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
