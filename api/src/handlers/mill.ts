import { roleCanEditOrganization } from '#utils/organizationRoles.ts'
import { redactLogValue } from '#utils/logs/redact.ts'
import { securityRules, matchSecurityRules } from '#utils/mill/securityRules.ts'
import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { parse as parseYaml } from 'yaml'

type MillEvent = Record<string, unknown>
type MillBody = { source?: Record<string, unknown>, events?: unknown }
type MillCondition = { path: string, operator: 'equals' | 'contains' | 'regex', value: string }
type MillDefinition = { match: 'all', conditions: MillCondition[], failureConditions?: MillCondition[], parameters?: Record<string, number> }
type MillRule = { id: string, detectionLogic?: string, recordId?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: MillDefinition }

export const MILL_RULES: MillRule[] = [
    ...securityRules.map(({ id, name, family, severity, explanation }) => ({ id, name, family, severity, explanation, version: '1', evidence: ['process executable', 'command line', 'host', 'user'] })),
    { id: 'auth.brute_force_success.v1', version: '1', name: 'Brute-force success', family: 'Authentication', severity: 'high', explanation: 'Multiple failed logins followed by a successful login for the same user.', evidence: ['failed event IDs', 'successful event ID', 'time window'] },
    { id: 'auth.password_spray.v1', version: '1', name: 'Password spray', family: 'Authentication', severity: 'high', explanation: 'One source IP produced failed logins for multiple users within 15 minutes.', evidence: ['source IP', 'target user IDs', 'failed event IDs', 'time window'] },
    { id: 'auth.impossible_travel.v1', version: '1', name: 'Impossible travel', family: 'Authentication', severity: 'high', explanation: 'Successful logins for one user occurred more than 500 km apart within 12 hours, with coordinates present in both events.', evidence: ['coordinates', 'distance', 'elapsed time', 'related event IDs'] },
    { id: 'auth.new_country.v1', version: '1', name: 'New country', family: 'Authentication', severity: 'medium', explanation: 'A successful login came from a country not seen in the user’s recent successful login history.', evidence: ['current country', 'previous country', 'related event IDs'] },
    { id: 'auth.new_device.v1', version: '1', name: 'New device', family: 'Authentication', severity: 'medium', explanation: 'A successful login used a device identifier not seen in the user’s recent successful login history.', evidence: ['current device', 'previous device', 'related event IDs'] },
    { id: 'network.signature_alert.v1', version: '1', name: 'Network signature alert', family: 'Network Detection', severity: 'high', explanation: 'A network telemetry record reported a matched signature with protocol and flow context.', evidence: ['signature ID or name', 'source and destination', 'protocol', 'event ID'] },
    { id: 'vulnerability.cve_asset_context.v1', version: '1', name: 'CVE on identified asset', family: 'Vulnerability', severity: 'high', explanation: 'A vulnerability event linked a CVE to an identified asset and version, giving analysts context for prioritization.', evidence: ['CVE', 'asset ID or hostname', 'asset version', 'event ID'] },
]

// Stored IDs remain unchanged so existing findings and organization overrides retain their lineage.
export function millRuleSlug(id: string) { return id.replace(/\.v\d+$/, '') }
export function millDefaultDefinition(id: string): MillDefinition {
    const parameters: Record<string, number> = {}
    if (['auth.brute_force_success', 'auth.password_spray'].includes(millRuleSlug(id))) Object.assign(parameters, { windowMinutes: 15, minimumCount: 3 })
    if (millRuleSlug(id) === 'auth.impossible_travel') Object.assign(parameters, { windowMinutes: 720, distanceKm: 500, historyLimit: 30 })
    if (['auth.new_country', 'auth.new_device'].includes(millRuleSlug(id))) parameters.historyLimit = 30
    return { match: 'all', conditions: [], parameters, ...(millRuleSlug(id) === 'auth.brute_force_success' ? { failureConditions: [] } : {}) }
}
function builtinDefinition(rule: MillRule, value?: unknown): MillDefinition {
    const defaults = millDefaultDefinition(rule.id)
    const stored = object(value)
    return { ...defaults, ...stored, parameters: { ...defaults.parameters, ...object(stored.parameters) } } as MillDefinition
}
export function normalizeBuiltinDefinition(id: string, value: unknown): { definition?: MillDefinition, error?: string } {
    const input = object(value), defaults = millDefaultDefinition(id)
    if (!value || typeof value !== 'object' || Array.isArray(value) || input.match !== 'all') return { error: 'Detection must use match: all.' }
    if (Object.keys(input).some(key => !['match', 'conditions', 'parameters', ...(defaults.failureConditions ? ['failureConditions'] : [])].includes(key))) return { error: 'Unsupported detection setting.' }
    const definition: MillDefinition = { ...defaults, parameters: { ...defaults.parameters } }
    for (const key of ['conditions', ...(defaults.failureConditions ? ['failureConditions'] : [])] as Array<'conditions' | 'failureConditions'>) {
        if (!Array.isArray(input[key])) return { error: `${key} must be an array.` }
        const result = input[key].length ? normalizeMillConditions(input[key]) : { conditions: [] }
        if (result.error) return { error: result.error }
        definition[key] = result.conditions
    }
    const parameters = object(input.parameters)
    if (!input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters) || Object.keys(parameters).some(key => !(key in defaults.parameters!))) return { error: 'Unsupported engine parameter.' }
    const limits: Record<string, [number, number]> = { windowMinutes: [1, 10080], minimumCount: [1, 1000], distanceKm: [1, 20040], historyLimit: [1, 1000] }
    for (const key of Object.keys(defaults.parameters!)) {
        const value = parameters[key], [min, max] = limits[key]
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return { error: `${key} must be a whole number from ${min} to ${max}.` }
        definition.parameters![key] = value
    }
    return { definition }
}

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
    if (events.length > 5000) {
        return res.status(413).send({ error: { code: 'mill_batch_too_large', message: 'Mill accepts at most 5,000 events per request.' } })
    }
    const invalidFields = validateMillEventFields(events as MillEvent[])
    if (invalidFields.length) {
        return res.status(400).send({ error: { code: 'invalid_mill_event_fields', message: 'Correct the invalid event fields and try again.', fields: invalidFields } })
    }

    const source = body?.source && typeof body.source === 'object' && !Array.isArray(body.source) ? body.source : {}
    const ingestionId = `mill_${randomUUID()}`
    const configuredRules = await loadConfiguredMillRules(key.organizationId)
    const accepted: string[] = []
    const normalizedEvents = (events as MillEvent[]).map(event => ({ normalized: normalizeMillEvent(event, source), eventId: randomUUID() }))
    const missingTimestamps = normalizedEvents.flatMap(({ normalized }, index) => normalized.timestamp
        ? []
        : [{ field: `events[${index}].timestamp`, message: 'timestamp is required and must be provided by the event.' }])
    if (missingTimestamps.length) {
        return res.status(400).send({ error: { code: 'invalid_mill_event_fields', message: 'Correct the invalid event fields and try again.', fields: missingTimestamps } })
    }
    for (let offset = 0; offset < normalizedEvents.length; offset += 50) {
        await Promise.all(normalizedEvents.slice(offset, offset + 50).map(async ({ normalized, eventId }) => {
            await run(`
            INSERT INTO mill_events (
                id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
                event_type, action, outcome, user_id, user_email, source_ip, source_country,
                source_city, device_id, normalized, original, parser_version, processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending')
            `, [
                eventId, ingestionId, key.organizationId, normalized.sourceVendor, normalized.sourceProduct,
                normalized.timestamp, normalized.eventType, normalized.action, normalized.outcome,
                normalized.userId, normalized.userEmail, normalized.sourceIp, normalized.sourceCountry,
                normalized.sourceCity, normalized.deviceId, JSON.stringify(normalized.normalized), JSON.stringify(normalized.original), normalized.parserVersion,
            ])
            accepted.push(eventId)
        }))
    }

    // Persist the complete batch before correlating it, including out-of-order payloads.
    for (const { normalized, eventId } of normalizedEvents.sort((a, b) => Date.parse(a.normalized.timestamp) - Date.parse(b.normalized.timestamp))) {
        await createMillFindings(key.organizationId, eventId, normalized, configuredRules)
        await run('UPDATE mill_events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [eventId, key.organizationId])
    }

    return res.status(202).send({ accepted: true, ingestion_id: ingestionId, accepted_events: accepted.length, rejected_events: 0 })
}

export async function getMillEvents(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string, limit?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const canReadLogs = (await hasRole(req, res, 'system_admin')).valid
    const result = await run(`
        SELECT id, ingestion_id, source_vendor, source_product, event_timestamp, received_at,
               event_type, action, outcome, user_id, user_email, source_ip, source_country,
               source_city, device_id, normalized, original, parser_version, processing_status
        FROM mill_events
        WHERE organization_id = $1 AND ($3::boolean OR ingestion_id <> 'logs')
        ORDER BY event_timestamp DESC, received_at DESC
        LIMIT $2
    `, [access.organizationId, limit, canReadLogs])
    return res.send({ organizationId: access.organizationId, events: result.rows })
}

export async function postMillEventAction(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string }, Body: { action?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (req.body?.action !== 'replay') return res.status(400).send({ error: 'Action must be replay.' })
    const result = await run(`
        SELECT id, ingestion_id, event_timestamp, event_type, action, outcome, user_id, user_email,
               source_ip, source_country, source_city, device_id, source_vendor, source_product,
               normalized, original, parser_version
        FROM mill_events
        WHERE id = $1 AND organization_id = $2
    `, [req.params.id, access.organizationId])
    const row = result.rows[0]
    if (!row) return res.status(404).send({ error: 'Mill event not found.' })
    if (row.ingestion_id === 'logs' && !(await hasRole(req, res, 'system_admin')).valid) return res.status(403).send({ error: 'Missing system_admin role.' })
    const event: NormalizedEvent = {
        timestamp: new Date(row.event_timestamp).toISOString(),
        eventType: String(row.event_type), action: String(row.action), outcome: String(row.outcome),
        userId: row.user_id ? String(row.user_id) : null, userEmail: row.user_email ? String(row.user_email) : null,
        sourceIp: row.source_ip ? String(row.source_ip) : null, sourceCountry: row.source_country ? String(row.source_country) : null,
        sourceCity: row.source_city ? String(row.source_city) : null, deviceId: row.device_id ? String(row.device_id) : null,
        sourceVendor: String(row.source_vendor), sourceProduct: String(row.source_product), parserVersion: String(row.parser_version || 'mill.v1'),
        normalized: object(row.normalized), original: object(row.original),
    }
    await createMillFindings(access.organizationId, String(row.id), event, await loadConfiguredMillRules(access.organizationId))
    await recordSystemEvent(req, { actionType: 'mill.event.replayed', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_event', targetId: req.params.id, context: { eventType: event.eventType } })
    return res.send({ replayed: true, eventId: req.params.id })
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
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage Mill rules.' })
    const body = req.body as { name?: unknown, explanation?: unknown, severity?: unknown, conditions?: unknown } | undefined
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const explanation = typeof body?.explanation === 'string' ? body.explanation.trim() : ''
    const severity = typeof body?.severity === 'string' && ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity : 'medium'
    const conditionResult = normalizeMillConditions(body?.conditions)
    if (name.length < 2 || name.length > 120) return res.status(400).send({ error: 'Rule name must contain 2-120 characters.' })
    if (explanation.length < 10 || explanation.length > 500) return res.status(400).send({ error: 'Rule explanation must contain 10-500 characters.' })
    if (!conditionResult.conditions.length || conditionResult.error) return res.status(400).send({ error: conditionResult.error || 'Add at least one valid rule condition.' })
    const ruleId = `custom.${randomUUID().replaceAll('-', '').slice(0, 20)}.v1`
    const rule = await saveMillRule(req, access, { id: ruleId, version: '1', name, family: 'Custom', severity, explanation, evidence: [], definition: { match: 'all', conditions: conditionResult.conditions }, source: 'owned', enabled: true }, 'mill.rule.created')
    return res.status(201).send({ rule })
}

export async function postMillRulePack(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Editor access is required to import Mill rules.' })
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
        await saveMillRule(req, access, { id: rule.ruleId, version: '1', name: rule.name, family: packName, severity: rule.severity, explanation: rule.explanation, definition: rule.definition, evidence: [], source: 'open_source', sourceReference, enabled: true }, 'mill.rule.imported', undefined, true)
    }
    await recordSystemEvent(req, { actionType: 'mill.rule_pack.imported', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_rule_pack', targetId: `${packSlug}@${packVersion}`, context: { packName, packVersion, sourceReference, ruleCount: prepared.length } })
    return res.status(201).send({ imported: prepared.length, pack: { name: packName, version: packVersion, sourceReference } })
}

export async function postMillSigmaPack(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Editor access is required to import Sigma rules.' })
    const body = req.body as { packName?: unknown, packVersion?: unknown, sourceReference?: unknown, yaml?: unknown } | undefined
    const packName = typeof body?.packName === 'string' ? body.packName.trim() : ''
    const packVersion = typeof body?.packVersion === 'string' ? body.packVersion.trim() : ''
    const sourceReference = typeof body?.sourceReference === 'string' ? body.sourceReference.trim() : ''
    if (packName.length < 2 || packName.length > 100 || packVersion.length < 1 || packVersion.length > 40) return res.status(400).send({ error: 'Pack name must contain 2-100 characters and version 1-40 characters.' })
    let reference: URL
    try { reference = new URL(sourceReference) } catch { return res.status(400).send({ error: 'Sigma source reference must be an HTTPS URL of at most 300 characters.' }) }
    if (reference.protocol !== 'https:' || !reference.hostname || sourceReference.length > 300) return res.status(400).send({ error: 'Sigma source reference must be an HTTPS URL of at most 300 characters.' })
    if (typeof body?.yaml !== 'string' || body.yaml.length > 200_000) return res.status(400).send({ error: 'Provide one Sigma YAML document up to 200,000 characters.' })
    let document: unknown
    try { document = parseYaml(body.yaml) } catch (error) { return res.status(400).send({ error: 'Sigma YAML is invalid.', detail: error instanceof Error ? error.message.slice(0, 300) : 'Unable to parse YAML.' }) }
    const compiled = compileSigmaDocument(document)
    if ('error' in compiled) return res.status(400).send({ error: compiled.error })
    const packSlug = packName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
    if (!packSlug) return res.status(400).send({ error: 'Pack name must contain letters or numbers.' })
    for (const rule of compiled.rules) {
        const ruleId = `sigma.${packSlug}.${rule.id}.v1`
        await saveMillRule(req, access, { id: ruleId, version: '1', name: rule.name, family: 'Sigma', severity: rule.severity, explanation: rule.explanation, definition: { match: 'all', conditions: rule.conditions }, evidence: [], source: 'open_source', sourceReference, enabled: true }, 'mill.rule.imported', undefined, true)
    }
    await recordSystemEvent(req, { actionType: 'mill.sigma_pack.imported', actorId: access.userId, organizationId: access.organizationId, targetType: 'mill_sigma_pack', targetId: `${packSlug}@${packVersion}`, context: { packName, packVersion, sourceReference, ruleCount: compiled.rules.length } })
    return res.status(201).send({ imported: compiled.rules.length, pack: { name: packName, version: packVersion, sourceReference } })
}

export async function postMillRuleAction(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string }, Body: { action?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage Mill rules.' })
    const action = req.body?.action === 'enable' || req.body?.action === 'disable' ? req.body.action : null
    if (!action) return res.status(400).send({ error: 'Action must be enable or disable.' })
    const rule = (await loadConfiguredMillRules(access.organizationId)).find(rule => millRuleSlug(rule.id) === millRuleSlug(req.params.id) || rule.recordId === req.params.id)
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    try {
        const saved = await saveMillRule(req, access, { ...rule, enabled: action === 'enable' }, 'mill.rule.updated', rule.version)
        return res.send({ rule: saved })
    } catch (error) {
        if (error instanceof RuleConflict) return res.status(409).send({ error: error.message })
        throw error
    }
}

export async function getMillRule(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string, offset?: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const rule = (await loadConfiguredMillRules(access.organizationId)).find(rule => millRuleSlug(rule.id) === millRuleSlug(req.params.id) || rule.recordId === req.params.id)
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    const requestedVersion = /\.v(\d+)$/.exec(req.params.id)?.[1]
    const isHistorical = Boolean(requestedVersion && requestedVersion !== rule.version)
    let displayedRule = rule
    if (isHistorical) {
        const history = await run(`SELECT context FROM system_events WHERE organization_id = $1 AND object_type = 'mill_rule'
            AND (object_id = $2 OR object_id = $3 OR context->>'ruleId' = $2)
            AND (context->'after'->>'version' = $4 OR context->'before'->>'version' = $4)
            ORDER BY created_at DESC, id DESC LIMIT 1`, [access.organizationId, rule.id, rule.recordId || rule.id, requestedVersion!])
        const context = history.rows[0]?.context
        const snapshot = context?.after?.version === requestedVersion ? context.after : context?.before
        if (!snapshot) return res.status(404).send({ error: 'This historical rule version is unavailable. Open the current rule using its version-free URL.' })
        displayedRule = { ...rule, ...snapshot, definition: rule.source === 'hanasand' ? builtinDefinition(rule, snapshot.definition) : snapshot.definition }
    }
    const offset = Math.max(0, Math.min(1000000, Number.parseInt(req.query.offset || '0', 10) || 0))
    const audit = await run(`SELECT id, event_type, actor_id, created_at, context
        FROM system_events WHERE organization_id = $1 AND object_type = 'mill_rule'
        AND (object_id = $2 OR object_id = $3 OR context->>'ruleId' = $2)
        ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET $4`, [access.organizationId, rule.id, rule.recordId || rule.id, offset])
    const triggers = await run(`SELECT count(*)::text AS count FROM mill_findings
        WHERE organization_id = $1 AND rule_id = $2`, [access.organizationId, rule.id])
    return res.send({ organizationId: access.organizationId, canEdit: !isHistorical && canManageMillRules(access.role), isHistorical, currentVersion: rule.version, rule: displayedRule, triggerCount: Number(triggers.rows[0].count), audit: audit.rows.slice(0, 50), nextOffset: audit.rows.length > 50 ? offset + 50 : null })
}

export async function putMillRule(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageMillRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage rules.' })
    const rule = (await loadConfiguredMillRules(access.organizationId)).find(rule => millRuleSlug(rule.id) === millRuleSlug(req.params.id))
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    const body = (req.body || {}) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : ''
    if (name.length < 2 || name.length > 120 || explanation.length < 10 || explanation.length > 500) return res.status(400).send({ error: 'Name must contain 2–120 characters and description 10–500 characters.' })
    if (!['low', 'medium', 'high', 'critical'].includes(String(body.severity)) || typeof body.enabled !== 'boolean' || typeof body.version !== 'string') return res.status(400).send({ error: 'A valid severity, enabled state and current version are required.' })
    let definition = rule.definition
    if (rule.source !== 'hanasand') {
        const normalized = normalizeMillConditions(body.conditions)
        if (normalized.error || !normalized.conditions.length) return res.status(400).send({ error: normalized.error || 'Add at least one condition.' })
        definition = { match: 'all', conditions: normalized.conditions }
    } else {
        if (body.conditions !== undefined) return res.status(400).send({ error: 'Use the detection definition to edit built-in selectors.' })
        if (body.definition !== undefined) {
            const normalized = normalizeBuiltinDefinition(rule.id, body.definition)
            if (normalized.error) return res.status(400).send({ error: normalized.error })
            definition = normalized.definition
        }
    }
    try {
        const saved = await saveMillRule(req, access, { ...rule, name, explanation, severity: String(body.severity), enabled: body.enabled, definition }, 'mill.rule.updated', body.version)
        return res.send({ rule: saved })
    } catch (error) {
        if (error instanceof RuleConflict) return res.status(409).send({ error: error.message })
        throw error
    }
}

class RuleConflict extends Error { constructor() { super('This rule changed since you opened it. Reload the rule before saving again.') } }

async function saveMillRule(req: FastifyRequest, access: { organizationId: string, userId: string }, rule: MillRule, action: string, expectedVersion?: string, preserveEnabled = false) {
    return withTransaction(async query => {
        // Serialize edits even when a built-in rule has no organization override yet.
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`mill-rule:${access.organizationId}:${rule.id}`])
        const existing = await query('SELECT * FROM mill_rules WHERE organization_id = $1 AND rule_id = $2 FOR UPDATE', [access.organizationId, rule.id])
        const row = existing.rows[0]
        const builtin = MILL_RULES.find(item => item.id === rule.id)
        const version = String(row?.version || builtin?.version || '0')
        if (expectedVersion !== undefined && expectedVersion !== version) throw new RuleConflict()
        const before = row ? { name: row.name, explanation: row.explanation, severity: row.severity, enabled: row.enabled, definition: builtin ? builtinDefinition(builtin, row.definition) : row.definition, version } : builtin ? { name: builtin.name, explanation: builtin.explanation, severity: builtin.severity, enabled: true, definition: millDefaultDefinition(builtin.id), version } : null
        const after = { name: rule.name, explanation: rule.explanation, severity: rule.severity, enabled: preserveEnabled && row ? Boolean(row.enabled) : rule.enabled !== false, definition: rule.definition || {}, version: String(Number(version) + 1) }
        if (action === 'mill.rule.updated' && before && ['name', 'explanation', 'severity', 'enabled', 'definition'].every(key => JSON.stringify(before[key as keyof typeof before]) === JSON.stringify(after[key as keyof typeof after]))) return { ...rule, version, recordId: row?.id }
        const result = await query(`INSERT INTO mill_rules (id, organization_id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
            ON CONFLICT (organization_id, rule_id) DO UPDATE SET version=EXCLUDED.version, name=EXCLUDED.name, family=EXCLUDED.family, severity=EXCLUDED.severity, explanation=EXCLUDED.explanation, definition=EXCLUDED.definition, source=EXCLUDED.source, source_reference=EXCLUDED.source_reference, enabled=EXCLUDED.enabled, updated_at=NOW()
            RETURNING id`, [row?.id || randomUUID(), access.organizationId, rule.id, after.version, rule.name, rule.family, rule.severity, rule.explanation, JSON.stringify(after.definition), rule.source || 'owned', rule.sourceReference || null, after.enabled, access.userId])
        await recordSystemEvent(req, { actionType: action, actorId: access.userId, organizationId: access.organizationId, source: 'mill', targetType: 'mill_rule', targetId: rule.id, context: { ruleId: rule.id, before, after } }, query)
        return { ...rule, version: after.version, enabled: after.enabled, recordId: result.rows[0].id }
    })
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

export async function loadConfiguredMillRules(organizationId: string): Promise<MillRule[]> {
    const result = await run(`
        SELECT id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled
        FROM mill_rules
        WHERE organization_id = $1
        ORDER BY created_at ASC
    `, [organizationId])
    const overrides = new Map((result.rows as Array<Record<string, unknown>>).map(row => [String(row.rule_id), row]))
    const builtIns = MILL_RULES.map(rule => {
        const override = overrides.get(rule.id)
        return { ...rule, definition: builtinDefinition(rule, override?.definition), detectionLogic: rule.explanation, ...(override ? { recordId: String(override.id), version: String(override.version), name: String(override.name), explanation: String(override.explanation), severity: String(override.severity) } : {}), enabled: override ? Boolean(override.enabled) : true, source: 'hanasand' as const }
    })
    const custom = (result.rows as Array<Record<string, unknown>>)
        .filter(row => !MILL_RULES.some(rule => rule.id === row.rule_id))
        .map(row => ({
            id: String(row.rule_id), recordId: String(row.id), version: String(row.version), name: String(row.name), family: String(row.family), severity: String(row.severity), explanation: String(row.explanation), evidence: millConditionEvidence(row.definition), enabled: Boolean(row.enabled), source: (row.source === 'open_source' ? 'open_source' : 'owned') as 'open_source' | 'owned', sourceReference: typeof row.source_reference === 'string' ? row.source_reference : undefined, definition: row.definition as MillRule['definition'],
        }))
    return [...builtIns, ...custom]
}

export function collectMillEventFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: MillRule[]) {
    const findings: Parameters<typeof persistFinding>[] = []
    const insertFinding = (org: string, id: string, severity: string, summary: string, eventIds: string[], evidence: MillEvent) => {
        const configured = rules.find(rule => rule.id === id)
        findings.push([org, id, configured?.severity || severity, summary, eventIds, { ...evidence, ruleVersion: configured?.version || '1', ruleName: configured?.name, ruleExplanation: configured?.explanation, detectionDefinition: configured?.definition }])
    }
    const enabled = new Set(rules.filter(rule => rule.enabled !== false && (rule.source !== 'hanasand' || matchesMillRule(event.normalized, rule.definition?.conditions || []))).map(rule => rule.id))
    for (const rule of matchSecurityRules(event.normalized).filter(rule => enabled.has(rule.id))) {
        insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { process: event.normalized.process, host: event.normalized.host, user: event.normalized.user, eventId })
    }
    for (const rule of rules.filter(rule => (rule.source === 'owned' || rule.source === 'open_source') && rule.enabled !== false)) {
        if (rule.definition && matchesMillRule(event.normalized, rule.definition.conditions)) {
            insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { ruleId: rule.id, matchedConditions: rule.definition.conditions, eventId })
        }
    }
    if (enabled.has('network.signature_alert.v1') && event.eventType === 'network' && (event.action === 'alert' || stringValue(event.normalized.signature_id) || stringValue(event.normalized.signature))) {
        insertFinding(organizationId, 'network.signature_alert.v1', 'high', `Network signature matched: ${stringValue(event.normalized.signature) || stringValue(event.normalized.signature_id) || 'unlabelled signature'}`, [eventId], { signatureId: stringValue(event.normalized.signature_id), signature: stringValue(event.normalized.signature), protocol: stringValue(object(event.normalized.protocol).name || event.normalized.proto || object(event.normalized.flow).proto), sourceIp: event.sourceIp, destinationIp: stringValue(event.normalized.dest_ip || event.normalized.destip), eventId })
    }
    const vulnerability = object(event.normalized.vulnerability)
    const asset = object(event.normalized.asset)
    const cve = stringValue(event.normalized.cve || event.normalized.cve_id || vulnerability.cve || vulnerability.cve_id)
    const assetId = stringValue(asset.id || asset.asset_id || asset.hostname || event.normalized.asset_id || event.normalized.hostname)
    const assetVersion = stringValue(asset.version || asset.software_version || event.normalized.asset_version || event.normalized.version)
    if (enabled.has('vulnerability.cve_asset_context.v1') && event.eventType === 'vulnerability' && cve && /^CVE-\d{4}-\d{4,}$/i.test(cve) && assetId && assetVersion) {
        insertFinding(organizationId, 'vulnerability.cve_asset_context.v1', 'high', `${cve} reported on ${assetId}`, [eventId], { cve, assetId, assetVersion, eventId })
    }
    return { enabled, findings }
}

export async function createMillFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: MillRule[]) {
    const { enabled, findings } = collectMillEventFindings(organizationId, eventId, event, rules)
    for (const finding of findings) await persistFinding(...finding)
    const insertFinding = async (org: string, id: string, severity: string, summary: string, eventIds: string[], evidence: MillEvent) => {
        const configured = rules.find(rule => rule.id === id)
        await persistFinding(org, id, configured?.severity || severity, summary, eventIds, { ...evidence, ruleVersion: configured?.version || '1', ruleName: configured?.name, ruleExplanation: configured?.explanation, detectionDefinition: configured?.definition })
    }
    const parameters = (id: string) => rules.find(rule => rule.id === id)?.definition?.parameters || millDefaultDefinition(id).parameters!
    if (event.eventType !== 'authentication' || event.action !== 'login') return
    const brute = rules.find(rule => rule.id === 'auth.brute_force_success.v1')
    if (enabled.has('auth.brute_force_success.v1') && event.userId && event.outcome === 'success') {
        const { windowMinutes, minimumCount } = parameters('auth.brute_force_success.v1')
        // Query the actual window, rather than truncating to the last 30 events.
        const failures = await run(`SELECT id, normalized FROM mill_events
            WHERE organization_id = $1 AND user_id = $2 AND id <> $3
              AND event_type = 'authentication' AND action = 'login' AND outcome = 'failure'
              AND event_timestamp BETWEEN ($4::timestamptz - $5 * INTERVAL '1 minute') AND $4::timestamptz
            ORDER BY event_timestamp DESC, id`, [organizationId, event.userId, eventId, event.timestamp, windowMinutes])
        const matching = failures.rows.filter((row: { normalized: MillEvent }) => matchesMillRule(row.normalized, brute?.definition?.failureConditions || []))
        if (matching.length >= minimumCount) {
            const failedEventIds = matching.slice(0, minimumCount).map((row: { id: string }) => row.id)
            await insertFinding(organizationId, 'auth.brute_force_success.v1', 'high', 'Successful login after repeated failures', [eventId, ...failedEventIds], { successfulEventId: eventId, failedEventIds, windowMinutes, minimumCount, matchedCount: matching.length })
        }
    }
    const historyLimit = Math.max(...['auth.new_country.v1', 'auth.new_device.v1', 'auth.impossible_travel.v1'].map(id => parameters(id).historyLimit))
    const previous = await run(`
        SELECT id, event_timestamp, outcome, source_country, normalized
        FROM mill_events
        WHERE organization_id = $1 AND user_id = $2 AND id <> $3
          AND event_type = 'authentication' AND action = 'login' AND event_timestamp <= $4::timestamptz
        ORDER BY event_timestamp DESC
        LIMIT $5
    `, [organizationId, event.userId, eventId, event.timestamp, historyLimit])
    const rows = previous.rows as Array<{ id: string, event_timestamp: string, outcome: string, source_country: string | null, normalized: MillEvent }>
    if (enabled.has('auth.password_spray.v1') && event.outcome === 'failure' && event.sourceIp) {
        const { windowMinutes, minimumCount } = parameters('auth.password_spray.v1')
        // Bound imported source text in the index; exact equality remains authoritative.
        const spray = await run(`
            SELECT id, user_id, event_timestamp, normalized
            FROM mill_events
            WHERE organization_id = $1 AND source_ip = $2 AND outcome = 'failure' AND id <> $3
              AND md5(source_ip) = md5($2::text)
              AND event_type = 'authentication' AND action = 'login'
              AND event_timestamp BETWEEN ($4::timestamptz - $5 * INTERVAL '1 minute') AND $4::timestamptz
            ORDER BY event_timestamp DESC
        `, [organizationId, event.sourceIp, eventId, event.timestamp, windowMinutes])
        const sprayRows = (spray.rows as Array<{ id: string, user_id: string | null, normalized: MillEvent }>).filter(row => matchesMillRule(row.normalized, rules.find(rule => rule.id === 'auth.password_spray.v1')?.definition?.conditions || []))
        const targetUsers = Array.from(new Set([event.userId, ...sprayRows.map(row => row.user_id)].filter(Boolean)))
        if (targetUsers.length >= minimumCount) {
            await insertFinding(organizationId, 'auth.password_spray.v1', 'high', 'Failed logins for multiple users from one source', [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], { sourceIp: event.sourceIp, userIds: targetUsers, failedEventIds: [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], windowMinutes, minimumCount })
        }
    }
    if (!event.userId) return
    if (event.outcome !== 'success') return
    const countryHistory = rows.slice(0, parameters('auth.new_country.v1').historyLimit).filter(row => row.outcome === 'success' && row.source_country)
    const priorSuccess = event.sourceCountry && !countryHistory.some(row => row.source_country === event.sourceCountry) ? countryHistory[0] : undefined
    if (enabled.has('auth.new_country.v1') && priorSuccess) {
        await insertFinding(organizationId, 'auth.new_country.v1', 'medium', `Login from new country: ${event.sourceCountry}`, [eventId, priorSuccess.id], { currentCountry: event.sourceCountry, previousCountry: priorSuccess.source_country })
    }
    const currentDevice = event.deviceId
    const deviceHistory = rows.slice(0, parameters('auth.new_device.v1').historyLimit).filter(row => row.outcome === 'success' && deviceIdFor(row.normalized))
    const priorDevice = currentDevice && !deviceHistory.some(row => deviceIdFor(row.normalized) === currentDevice) ? deviceHistory[0] : undefined
    if (enabled.has('auth.new_device.v1') && priorDevice) {
        await insertFinding(organizationId, 'auth.new_device.v1', 'medium', 'Successful login from a new device', [eventId, priorDevice.id], { currentDevice, previousDevice: deviceIdFor(priorDevice.normalized) })
    }
    const coordinates = coordinatesFor(event.normalized)
    const priorCoordinates = rows.slice(0, parameters('auth.impossible_travel.v1').historyLimit).map(row => ({ row, coordinates: coordinatesFor(row.normalized) })).find(item => item.row.outcome === 'success' && item.coordinates && coordinates)
    if (enabled.has('auth.impossible_travel.v1') && priorCoordinates && coordinates) {
        const minutes = Math.abs(Date.parse(event.timestamp) - Date.parse(priorCoordinates.row.event_timestamp)) / 60_000
        const distanceKm = distance(coordinates, priorCoordinates.coordinates!)
        if (minutes < parameters('auth.impossible_travel.v1').windowMinutes && distanceKm > parameters('auth.impossible_travel.v1').distanceKm) {
            await insertFinding(organizationId, 'auth.impossible_travel.v1', 'high', 'Successful logins from geographically incompatible locations', [eventId, priorCoordinates.row.id], { current: coordinates, previous: priorCoordinates.coordinates, distanceKm: Math.round(distanceKm), elapsedMinutes: Math.round(minutes) })
        }
    }
}

async function persistFinding(organizationId: string, ruleId: string, severity: string, summary: string, eventIds: string[], evidence: MillEvent) {
    const findingKey = `${organizationId}:${ruleId}:${eventIds.slice().sort().join(',')}`
    await run(`
        INSERT INTO mill_findings (id, organization_id, finding_key, rule_id, severity, status, summary, evidence, event_ids, first_observed, last_observed)
        VALUES ($1, $2, $3, $4, $5, 'new', $6,
            $7::jsonb || jsonb_build_object('restrictedLog', EXISTS (SELECT 1 FROM mill_events WHERE organization_id = $2 AND id = ANY($8::text[]) AND ingestion_id = 'logs')),
            $8, NOW(), NOW())
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
    parserVersion: string
    normalized: MillEvent
    original: MillEvent
}

export function normalizeMillEvent(event: MillEvent, source: Record<string, unknown>): NormalizedEvent {
    const adapted = adaptVendorEvent(event, source)
    const user = object(adapted.user)
    const sourceContext = object(adapted.source)
    const timestamp = typeof adapted.timestamp === 'string' && !Number.isNaN(Date.parse(adapted.timestamp)) ? new Date(adapted.timestamp).toISOString() : ''
    const vendor = stringValue(source.vendor) || 'custom'
    const product = stringValue(source.product) || 'generic-json'
    const parserVersion = vendor.toLowerCase().includes('azure') || product.toLowerCase().includes('entra') ? 'mill.azure-entra.v1' : vendor.toLowerCase().includes('defender') || product.toLowerCase().includes('defender') ? 'mill.defender.v1' : /suricata|snort|eve|network/i.test(`${vendor} ${product}`) ? 'mill.network-eve.v1' : 'mill.v1'
    return {
        timestamp,
        eventType: stringValue(adapted.event_type || adapted.category) || 'unknown',
        action: stringValue(adapted.action) || 'unknown',
        outcome: stringValue(adapted.outcome || adapted.result) || 'unknown',
        userId: stringValue(user.id || adapted.user_id),
        userEmail: stringValue(user.email || adapted.user_email),
        sourceIp: stringValue(sourceContext.ip || adapted.source_ip),
        sourceCountry: stringValue(sourceContext.country || adapted.country),
        sourceCity: stringValue(sourceContext.city || adapted.city),
        deviceId: stringValue(object(adapted.device).id || adapted.device_id),
        sourceVendor: vendor,
        sourceProduct: product,
        parserVersion,
        normalized: redact({ ...adapted, timestamp }),
        original: redact(event),
    }
}

export function adaptVendorEvent(event: MillEvent, source: Record<string, unknown>): MillEvent {
    const vendor = `${stringValue(source.vendor) || ''} ${stringValue(source.product) || ''}`.toLowerCase()
    if (/azure|entra|azure ad|microsoft identity/.test(vendor)) {
        const location = object(event.location)
        const detail = object(event.deviceDetail || event.device_detail)
        const resultType = event.resultType ?? event.result_type
        const geo = object(location.geoCoordinates)
        return { ...event, timestamp: event.timestamp || event.timeGenerated || event.TimeGenerated, event_type: event.event_type || 'authentication', action: event.action || 'login', outcome: event.outcome || (String(resultType ?? '').toLowerCase() === '0' || String(resultType ?? '').toLowerCase() === 'success' ? 'success' : resultType !== undefined ? 'failure' : 'unknown'), user: event.user || { id: event.user_id || event.userId || event.userPrincipalName || event.user_principal_name, email: event.user_email || event.userPrincipalName || event.user_principal_name }, source: { ...object(event.source), ip: object(event.source).ip || event.callerIpAddress || event.caller_ip_address, country: object(event.source).country || location.countryOrRegion || location.country, city: object(event.source).city || location.city, coordinates: object(event.source).coordinates || { latitude: geo.latitude, longitude: geo.longitude } }, device: event.device || { id: event.device_id || detail.deviceId || detail.device_id } }
    }
    if (/defender|endpoint/.test(vendor)) {
        const result = event.ResultType ?? event.resultType ?? event.result
        const actionType = event.ActionType || event.action_type
        return { ...event, timestamp: event.timestamp || event.Timestamp || event.timeGenerated, event_type: event.event_type || 'authentication', action: event.action || (actionType ? 'login' : 'unknown'), outcome: event.outcome || (String(result ?? '').toLowerCase() === 'success' || String(result ?? '') === '0' ? 'success' : result !== undefined ? 'failure' : 'unknown'), user: event.user || { id: event.user_id || event.AccountSid || event.accountSid || event.AccountName || event.accountName, email: event.user_email || event.AccountName || event.accountName }, source: { ...object(event.source), ip: object(event.source).ip || event.IpAddress || event.IPAddress || event.RemoteIP, country: object(event.source).country || event.CountryCode, city: object(event.source).city || event.City }, device: event.device || { id: event.device_id || event.DeviceId || event.MachineId || event.machineId } }
    }
    if (/suricata|snort|eve|network/.test(vendor)) {
        const alert = object(event.alert)
        return { ...event, timestamp: event.timestamp || event.tstamp || event.Timestamp, event_type: event.event_type || (alert.signature_id || alert.signature ? 'network' : event.event_type), action: event.action || (alert.signature_id || alert.signature ? 'alert' : 'network'), outcome: event.outcome || (alert.signature_id || alert.signature ? 'detected' : 'unknown'), source: { ...object(event.source), ip: object(event.source).ip || event.src_ip || event.srcip, city: object(event.source).city || event.src_port, country: object(event.source).country || event.proto }, signature_id: event.signature_id || alert.signature_id, signature: event.signature || alert.signature }
    }
    return event
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
function canManageMillRules(role: string) { return roleCanEditOrganization(role) }
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

export function compileSigmaDocument(value: unknown): { rules: Array<{ id: string, name: string, severity: string, explanation: string, conditions: MillCondition[] }> } | { error: string } {
    const document = object(value)
    const title = stringValue(document.title)
    const detection = object(document.detection)
    if (!title || !Object.keys(detection).length) return { error: 'Sigma document must contain title and detection.' }
    const conditionText = stringValue(detection.condition) || 'selection'
    const selectors = Object.entries(detection).filter(([key]) => key !== 'condition')
    const selectorMap = new Map<string, MillCondition[]>()
    for (const [selectorName, selectorValue] of selectors) {
        const conditions = sigmaSelectionConditions(selectorValue)
        if ('error' in conditions) return { error: `${selectorName}: ${conditions.error}` }
        selectorMap.set(selectorName, conditions.conditions)
    }
    const names = Array.from(selectorMap.keys())
    const groups = conditionText.toLowerCase().includes(' or ')
        ? conditionText.split(/\s+or\s+/i).map(item => item.trim())
        : conditionText.match(/^\s*\d+\s+of\s+([a-z0-9_*.-]+)\s*$/i)
            ? names.filter(name => name.startsWith(conditionText.match(/^\s*\d+\s+of\s+([a-z0-9_*.-]+)\s*$/i)![1].replace('*', '')))
            : [conditionText.trim()]
    const rules = []
    for (const [index, group] of groups.entries()) {
        const referenced = [...group.matchAll(/[a-zA-Z0-9_.-]+/g)].map(match => match[0]).filter(name => selectorMap.has(name))
        const conditions = (referenced.length ? referenced : [group]).flatMap(name => selectorMap.get(name) || [])
        if (!conditions.length || conditions.length > 8 || /\bnot\b|\bnear\b|\bwithin\b|\bregex\b/i.test(group)) return { error: `Unsupported Sigma condition '${group}'. Use bounded selection, OR, or 1 of selection* syntax.` }
        rules.push({ id: `${slug(title)}-${index + 1}`, name: referenced.length > 1 ? `${title} (${referenced.join(' + ')})` : title, severity: sigmaSeverity(document.level), explanation: `Imported Sigma rule from ${stringValue(object(document.logsource).product) || 'declared log source'} using bounded field selections.`, conditions })
    }
    return { rules }
}

function sigmaSelectionConditions(value: unknown): { conditions: MillCondition[] } | { error: string } {
    const selection = object(value)
    const entries = Object.entries(selection)
    if (!entries.length) return { error: 'selection must contain fields.' }
    const conditions: MillCondition[] = []
    for (const [rawPath, rawValue] of entries) {
        const [path, modifier] = rawPath.split('|', 2)
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(path)) return { error: `field '${path}' is outside the bounded field syntax.` }
        const values = Array.isArray(rawValue) ? rawValue : [rawValue]
        const strings = values.map(value => typeof value === 'string' ? value : String(value)).filter(Boolean)
        if (!strings.length || strings.join('|').length > 200) return { error: `field '${path}' has an invalid value.` }
        if (strings.length > 1) {
            conditions.push({ path, operator: 'regex', value: `^(?:${strings.map(escapeRegex).join('|')})$` })
            continue
        }
        const valueText = strings[0]
        if (modifier === 're') conditions.push({ path, operator: 'regex', value: valueText })
        else if (modifier === 'startswith') conditions.push({ path, operator: 'regex', value: `^${escapeRegex(valueText)}` })
        else if (modifier === 'endswith') conditions.push({ path, operator: 'regex', value: `${escapeRegex(valueText)}$` })
        else if (modifier === 'contains' || valueText.includes('*')) conditions.push({ path, operator: 'contains', value: valueText.replaceAll('*', '') })
        else conditions.push({ path, operator: 'equals', value: valueText })
    }
    return { conditions }
}
function sigmaSeverity(value: unknown) { return value === 'critical' || value === 'high' || value === 'medium' || value === 'low' ? value : 'medium' }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rule' }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
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
function redact(value: unknown): MillEvent { return redactLogValue(value) as MillEvent }
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
