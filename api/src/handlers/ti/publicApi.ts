import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'
import { publicTiOpenApi } from '../../contracts/publicTiOpenApi.ts'
import { normalizeBatchQueries, TI_BATCH_MAX_QUERIES } from './search.ts'
import { searchThreatIntel, type TiSearchResponse } from '#utils/ti/search.ts'

type PublicApiOptions = FastifyPluginOptions & {
    fetchImpl?: typeof fetch
    searchImpl?: typeof searchThreatIntel
}

type PublicRequest = FastifyRequest & {
    apiKeyAuth?: {
        organizationId?: string | null
        apiKey?: { organizationId?: string | null }
    }
    rateLimitSession?: unknown
}

const RESOURCE_ROUTES = {
    '/actors': ['actor-profiles', 'actorProfiles', publicActor],
    '/aliases': ['actor-aliases', 'actorAliases', publicAlias],
    '/incidents': ['incidents', 'incidents', publicIncident],
    '/claims': ['claims', 'claims', publicClaim],
    '/evidence': ['evidence-links', 'evidenceLinks', publicEvidence],
    '/sources': ['sources', 'sources', publicSource],
    '/validations': ['validation-records', 'validationRecords', publicValidation],
    '/alerts': ['alerts', 'alerts', publicAlert],
    '/evaluation': ['evaluation-labels', 'evaluationLabels', publicEvaluation],
    '/timeliness': ['timeliness', 'timeliness', publicTimeliness],
} as const

export default async function publicTiApi(fastify: FastifyInstance, options: PublicApiOptions) {
    const fetchImpl = options.fetchImpl ?? fetch
    const searchImpl = options.searchImpl ?? searchThreatIntel

    fastify.addHook('onSend', async (req, reply, payload) => {
        reply.header('cache-control', 'no-store, max-age=0')
        reply.header('pragma', 'no-cache')
        reply.header('x-request-id', req.id)
        if (reply.statusCode < 400) return payload
        reply.type('application/json; charset=utf-8')
        return JSON.stringify(normalizeError(payload, reply.statusCode, req.id))
    })

    fastify.setErrorHandler((cause, req, reply) => {
        const error = cause as { statusCode?: number }
        const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500
        return sendError(reply, req.id, status, status === 400 ? 'invalid_request' : 'internal_error', status === 400 ? 'The request body is invalid.' : 'The request could not be completed.')
    })

    fastify.get('/openapi.json', async () => publicTiOpenApi)

    fastify.post('/ti/search', async (req: FastifyRequest<{ Body: { query?: unknown } }>, reply) => {
        const query = normalizeQueryBody(req.body)
        if (!query) return sendError(reply, req.id, 400, 'invalid_query', 'query must contain 2-200 characters.')
        try {
            return publicSearchResult(await searchImpl({ query }))
        } catch {
            return sendError(reply, req.id, 503, 'search_unavailable', 'Threat-intelligence search is temporarily unavailable.')
        }
    })

    fastify.post('/ti/search/batch', async (req: FastifyRequest<{ Body: { queries?: unknown } }>, reply) => {
        if (!hasAuthenticatedPrincipal(req)) return sendError(reply, req.id, 401, 'authentication_required', 'An API key or authenticated session is required.')
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => key !== 'queries')) {
            return sendError(reply, req.id, 400, 'invalid_request', 'batch search accepts only the queries field.')
        }
        if (Array.isArray(req.body.queries) && req.body.queries.length > TI_BATCH_MAX_QUERIES) {
            return sendError(reply, req.id, 400, 'too_many_queries', `batch search accepts at most ${TI_BATCH_MAX_QUERIES} input queries.`)
        }
        const queries = normalizeBatchQueries(req.body.queries)
        if (!queries.length) return sendError(reply, req.id, 400, 'invalid_queries', 'queries must contain values of 2-200 characters.')

        const results = await mapConcurrent(queries, 3, async query => {
            try {
                return { query, status: 'ok' as const, result: publicSearchResult(await searchImpl({ query })) }
            } catch {
                return { query, status: 'error' as const, error: publicError('search_unavailable', 'Threat-intelligence search is temporarily unavailable.', req.id) }
            }
        })
        const partial = results.some(result => result.status === 'error')
        return reply.status(partial ? 207 : 200).send({ generatedAt: new Date().toISOString(), count: results.length, partial, results })
    })

    for (const [route, [upstream, responseKey, project]] of Object.entries(RESOURCE_ROUTES)) {
        fastify.get(route, async (req: FastifyRequest<{ Querystring: { q?: unknown, limit?: unknown, cursor?: unknown } }>, reply) => {
            if (!hasAuthenticatedPrincipal(req)) return sendError(reply, req.id, 401, 'authentication_required', 'An API key or authenticated session is required.')
            const organizationId = apiKeyOrganizationId(req)
            if (route === '/alerts' && !organizationId) return sendError(reply, req.id, 403, 'organization_scope_required', 'Tenant-scoped alerts require an organization API key.')
            const query = parseCollectionQuery(req.query)
            if (!query.ok) return sendError(reply, req.id, 400, 'invalid_pagination', query.error)
            try {
                const upstreamPayload = await fetchCollection(fetchImpl, upstream, responseKey, query, route === '/alerts' ? organizationId : undefined)
                return {
                    data: upstreamPayload.records.map(project).filter(item => typeof item.id === 'string'),
                    pagination: { limit: query.limit, total: upstreamPayload.total, nextCursor: upstreamPayload.nextCursor ?? null },
                    meta: { requestId: req.id, ...(organizationId ? { organizationId } : {}) },
                }
            } catch {
                return sendError(reply, req.id, 503, 'upstream_unavailable', 'The intelligence data service is temporarily unavailable.')
            }
        })
    }
}

function apiKeyOrganizationId(req: FastifyRequest) {
    const auth = (req as PublicRequest).apiKeyAuth
    const value = auth?.organizationId ?? auth?.apiKey?.organizationId
    return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value) ? value : undefined
}

function hasAuthenticatedPrincipal(req: FastifyRequest) {
    const request = req as PublicRequest
    return Boolean(request.apiKeyAuth || request.rateLimitSession)
}

function normalizeQueryBody(body: { query?: unknown } | undefined) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'query')) return ''
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    return query.length >= 2 && query.length <= 200 ? query : ''
}

function parseCollectionQuery(query: { q?: unknown, limit?: unknown, cursor?: unknown }) {
    const limit = query.limit === undefined ? 50 : Number(query.limit)
    const cursor = query.cursor === undefined ? 0 : Number(query.cursor)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { ok: false as const, error: 'limit must be an integer from 1 to 100.' }
    if (!Number.isInteger(cursor) || cursor < 0) return { ok: false as const, error: 'cursor must be a non-negative integer.' }
    if (query.q !== undefined && (typeof query.q !== 'string' || query.q.trim().length > 200)) return { ok: false as const, error: 'q must contain at most 200 characters.' }
    return { ok: true as const, limit, cursor, q: typeof query.q === 'string' ? query.q.trim() : '' }
}

async function fetchCollection(
    fetchImpl: typeof fetch,
    upstream: string,
    responseKey: string,
    query: { limit: number, cursor: number, q: string },
    organizationId?: string,
) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (!base) throw new Error('TI_SCRAPER_API_BASE is not configured')
    const url = new URL(`${base}/v1/intel/${upstream}`)
    url.searchParams.set('limit', String(query.limit))
    url.searchParams.set('cursor', String(query.cursor))
    if (query.q) url.searchParams.set('q', query.q)
    const response = await fetchImpl(url, {
        headers: { accept: 'application/json', ...(organizationId ? { 'x-tenant-id': organizationId } : {}) },
        signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`upstream returned ${response.status}`)
    const payload = await response.json() as Record<string, unknown>
    const records = Array.isArray(payload[responseKey]) ? payload[responseKey] as unknown[] : []
    return {
        records,
        total: nonNegativeInteger(payload.total) ?? records.length,
        nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : undefined,
    }
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length)
    let index = 0
    async function worker() {
        while (index < items.length) {
            const current = index++
            results[current] = await mapper(items[current])
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
    return results
}

function publicSearchResult(result: TiSearchResponse) {
    const actorIntelligence = result.actorIntelligence
    const actionability = result.actionability
    return compact({
        query: result.query,
        queryKind: result.queryKind,
        generatedAt: result.generatedAt,
        mode: result.mode,
        status: result.status,
        runId: result.runId,
        refreshAfterSeconds: finiteNumber(result.refreshAfterSeconds),
        summary: result.summary,
        confidence: confidence(result.confidence),
        lastSeen: result.lastSeen,
        aliases: strings(result.aliases),
        recentActivity: array(result.recentActivity).map(item => compact({
            date: text(item.date), title: text(item.title), detail: text(item.detail), confidence: confidence(item.confidence), sourceIds: strings(item.sourceIds),
            url: httpUrl(item.url), claimType: text(item.claimType), victimName: text(item.victimName), affectedSectors: strings(item.affectedSectors), countries: strings(item.countries),
            impact: text(item.impact), firstReportedAt: iso(item.firstReportedAt), lastReportedAt: iso(item.lastReportedAt), publisherCount: nonNegativeInteger(item.publisherCount),
            corroboratingSourceIds: strings(item.corroboratingSourceIds), contradictingSourceIds: strings(item.contradictingSourceIds),
        })),
        targets: array(result.targets).map(item => compact({ sector: text(item.sector), regions: strings(item.regions), rationale: text(item.rationale), confidence: confidence(item.confidence) })),
        ttps: array(result.ttps).map(item => compact({ name: text(item.name), attackId: text(item.attackId), tactic: text(item.tactic), detail: text(item.detail), confidence: confidence(item.confidence), extractionMethod: text(item.extractionMethod)?.slice(0, 120), extractorVersion: text(item.extractorVersion)?.slice(0, 120) })),
        datasets: array(result.datasets).map(item => compact({ name: text(item.name), type: text(item.type), coverage: text(item.coverage), status: text(item.status), url: httpUrl(item.url) })),
        sources: array(result.sources).map(item => compact({ id: text(item.id), name: text(item.name), type: text(item.type), provenance: text(item.provenance), url: httpUrl(item.url), captureId: text(item.captureId), sourceRequestId: text(item.sourceRequestId), sourceFamily: text(item.sourceFamily), parserStatus: text(item.parserStatus), reportDate: iso(item.reportDate), lastCollectedAt: iso(item.lastCollectedAt) })),
        notes: strings(result.notes),
        actorIntelligence: actorIntelligence ? compact({
            actorClass: text(actorIntelligence.actorClass), attribution: text(actorIntelligence.attribution), firstSeen: iso(actorIntelligence.firstSeen), lastSeen: iso(actorIntelligence.lastSeen),
            motivation: strings(actorIntelligence.motivation), malwareTools: strings(actorIntelligence.malwareTools), campaigns: strings(actorIntelligence.campaigns), infrastructure: publicIndicators(actorIntelligence.infrastructure),
            targetSectors: strings(actorIntelligence.targetSectors), geographies: strings(actorIntelligence.geographies), confidence: confidence(actorIntelligence.confidence), confidenceReasoning: strings(actorIntelligence.confidenceReasoning), sourceProvenance: strings(actorIntelligence.sourceProvenance),
        }) : undefined,
        actionability: actionability ? compact({
            schemaVersion: actionability.schemaVersion, alertDisposition: actionability.alertDisposition, shouldAlert: boolean(actionability.shouldAlert), rationale: text(actionability.rationale),
            watchlistCandidates: array(actionability.watchlistCandidates).map(candidate => compact({ kind: text(candidate.kind), value: text(candidate.value), reason: text(candidate.reason), confidence: confidence(candidate.confidence) })),
        }) : undefined,
    })
}

function publicActor(value: unknown) { const row = record(value); return compact({ id: text(row.id), canonicalName: text(row.canonicalName ?? row.actor), normalizedName: text(row.normalizedName), actorType: text(row.actorType), aliases: strings(row.aliases), confidence: confidence(row.confidence), firstSeenAt: iso(row.firstSeenAt), lastSeenAt: iso(row.lastSeenAt), evidenceCount: nonNegativeInteger(row.evidenceCount), sourceIds: strings(row.sourceIds), captureIds: strings(row.captureIds), reviewState: text(row.reviewState), updatedAt: iso(row.updatedAt) }) }
function publicAlias(value: unknown) { const row = record(value); return compact({ id: text(row.id), actorProfileId: text(row.actorProfileId), alias: text(row.alias), normalizedAlias: text(row.normalizedAlias), confidence: confidence(row.confidence), firstSeenAt: iso(row.firstSeenAt), lastSeenAt: iso(row.lastSeenAt), evidenceCount: nonNegativeInteger(row.evidenceCount), sourceIds: strings(row.sourceIds), updatedAt: iso(row.updatedAt) }) }
function publicIncident(value: unknown) {
    const row = record(value)
    const attribution = record(row.actorAttribution)
    const provenance = record(attribution.provenance)
    const automatic = record(row.automaticReview)
    const runtime = record(automatic.runtimeIdentity)
    const attributionProvenance = compact({
        promptVersion: boundedIncidentText(provenance.promptVersion),
        responseSchemaVersion: boundedIncidentText(provenance.responseSchemaVersion),
        evidenceProjectionSchema: boundedIncidentText(provenance.evidenceProjectionSchema),
        reviewedAt: incidentIso(provenance.reviewedAt),
    })
    const canonicalName = boundedIncidentText(attribution.canonicalName)
    const confirmedAttribution = row.reviewState === 'confirmed'
        && text(attribution.identityId)
        && canonicalName
        && Object.keys(attributionProvenance).length
        ? compact({
            externalId: boundedIncidentText(attribution.externalId),
            catalogId: boundedIncidentText(attribution.catalogId),
            canonicalName,
            aliases: boundedIncidentStrings(attribution.aliases),
            supportingEvidenceCount: boundedIncidentInteger(attribution.supportingEvidenceCount, 100)
                ?? boundedIncidentArrayLength(attribution.supportingEvidenceIds, 100),
            provenance: attributionProvenance,
        })
        : null
    const configuredModelVersion = boundedIncidentText(automatic.configuredModelVersion)
    const runtimeStatus = incidentEnum(runtime.status, ['completed'])
    const runtimeProvider = boundedIncidentText(runtime.provider)
    const runtimeModel = boundedIncidentText(runtime.model)
    return compact({
        id: boundedIncidentText(row.id),
        title: boundedIncidentText(row.title, 500),
        summary: boundedIncidentText(row.summary, 4000),
        firstSeenAt: incidentIso(row.firstSeenAt),
        confidence: confidence(row.confidence),
        assertionKind: 'inferred',
        reviewState: boundedIncidentText(row.reviewState, 100),
        actorAttribution: confirmedAttribution,
        automaticReview: configuredModelVersion ? compact({
            configuredModelVersion,
            runtimeIdentity: runtimeStatus && runtimeProvider && runtimeModel ? {
                status: runtimeStatus,
                provider: runtimeProvider,
                model: runtimeModel,
            } : undefined,
            promptVersion: boundedIncidentText(automatic.promptVersion),
            responseSchemaVersion: boundedIncidentText(automatic.responseSchemaVersion),
            evidenceProjectionSchema: boundedIncidentText(automatic.evidenceProjectionSchema),
            linkedEvidenceCount: boundedIncidentInteger(automatic.linkedEvidenceCount, 100_000),
            linkedSourceCount: boundedIncidentInteger(automatic.linkedSourceCount, 100_000),
            linkedIndependentSourceCount: boundedIncidentInteger(automatic.linkedIndependentSourceCount, 100_000),
            reviewedAt: incidentIso(automatic.reviewedAt),
            action: incidentEnum(automatic.action, ['confirm', 'reject', 'mark_contradicted', 'mark_needs_review']),
            claimValidity: incidentEnum(automatic.claimValidity, ['supported', 'invalid', 'contradicted', 'uncertain']),
            confidence: confidence(automatic.confidence),
        }) : undefined,
        extractorVersion: boundedIncidentText(row.extractorVersion),
    })
}
function publicClaim(value: unknown) { const row = record(value); return compact({ id: text(row.id), claimType: text(row.claimType), subjectType: text(row.subjectType), subjectId: text(row.subjectId), value: publicClaimValue(row.value), summary: text(row.summary), confidence: confidence(row.confidence), evidenceStage: text(row.evidenceStage), extractionMethod: text(row.extractionMethod), extractorVersion: text(row.extractorVersion), reviewState: text(row.reviewState), corroborationState: text(row.corroborationState), sourceCount: nonNegativeInteger(row.sourceCount), evidenceCount: nonNegativeInteger(row.evidenceCount), firstSeenAt: iso(row.firstSeenAt), lastSeenAt: iso(row.lastSeenAt), sourceIds: strings(row.sourceIds), captureIds: strings(row.captureIds), uncertaintyReasons: strings(row.uncertaintyReasons), legalHold: boolean(row.legalHold), retentionClass: text(row.retentionClass), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }) }
function publicEvidence(value: unknown) { const row = record(value); return compact({ id: text(row.id), captureId: text(row.captureId), subjectType: text(row.subjectType), subjectId: text(row.subjectId), relationship: text(row.relationship), confidence: confidence(row.confidence), extractorVersion: text(row.extractorVersion), createdAt: iso(row.createdAt) }) }
function publicSource(value: unknown) { const row = record(value); const operating = record(row.operatingMode); const publisher = record(row.publisher); const collection = record(row.collection); return compact({ id: text(row.id), name: text(row.name), type: text(row.type), status: text(row.status), risk: text(row.risk), trustScore: confidence(row.trustScore), language: text(row.language), tags: strings(row.tags), url: httpUrl(row.url), urlHash: text(row.urlHash), locatorRedacted: boolean(row.locatorRedacted), operatingMode: compact({ accessMethod: text(operating.accessMethod), metadataOnly: boolean(operating.metadataOnly), approvalState: text(operating.approvalState), policyVersion: text(operating.policyVersion) }), publisher: Object.keys(publisher).length ? compact({ name: text(publisher.name), country: text(publisher.country), homepage: httpUrl(publisher.homepage), trustBasis: text(publisher.trustBasis) }) : undefined, collection: compact({ cadenceSeconds: nonNegativeInteger(collection.cadenceSeconds), freshnessTargetSeconds: nonNegativeInteger(collection.freshnessTargetSeconds), lastSeenAt: iso(collection.lastSeenAt), createdAt: iso(collection.createdAt), updatedAt: iso(collection.updatedAt) }) }) }
function publicValidation(value: unknown) { const row = record(value); return compact({ id: text(row.id), captureId: text(row.captureId), incidentId: text(row.incidentId), claimId: text(row.claimId), validationType: text(row.validationType), status: text(row.status), referenceUrl: httpUrl(row.referenceUrl), referencePublishedAt: iso(row.referencePublishedAt), matchedAt: iso(row.matchedAt), notes: text(row.notes), updatedAt: iso(row.updatedAt) }) }
function publicAlert(value: unknown) { const row = record(value); const evidence = record(row.evidence); return compact({ id: text(row.id), incidentId: text(row.incidentId), actor: text(row.actor), victim: text(row.victim), assertionKind: text(row.assertionKind), observedMatchSummary: text(row.observedMatchSummary), summary: text(row.summary), severity: text(row.severity), confidence: confidence(row.confidence), reviewState: text(row.reviewState), workflowState: text(row.workflowState), deliveryState: text(row.deliveryState), sourceFamily: text(row.sourceFamily), firstSeenAt: iso(row.firstSeenAt), lastSeenAt: iso(row.lastSeenAt), alertedAt: iso(row.alertedAt), deliveredAt: iso(row.deliveredAt), evidence: compact({ captureIds: strings(evidence.captureIds), sourceIds: strings(evidence.sourceIds), evidenceCount: nonNegativeInteger(evidence.evidenceCount), sourceCount: nonNegativeInteger(evidence.sourceCount), metadataOnly: boolean(evidence.metadataOnly) }) }) }
function publicEvaluation(value: unknown) { const row = record(value); return compact({ id: text(row.id), captureId: text(row.captureId), incidentId: text(row.incidentId), entityId: text(row.entityId), indicatorId: text(row.indicatorId), claimId: text(row.claimId), labelType: text(row.labelType), expectedValue: scalar(row.expectedValue), observedValue: scalar(row.observedValue), outcome: text(row.outcome), labeledBy: text(row.labeledBy), labelingMethod: text(row.labelingMethod), independentFromExtractor: boolean(row.independentFromExtractor), labeledAt: iso(row.labeledAt), datasetSplit: text(row.datasetSplit), notes: text(row.notes), updatedAt: iso(row.updatedAt) }) }
function publicTimeliness(value: unknown) { const row = record(value); const latencies = record(row.latencies); return compact({ id: text(row.id), sourceId: text(row.sourceId), captureId: text(row.captureId), incidentId: text(row.incidentId), firstReportedAt: iso(row.firstReportedAt), reportedAt: iso(row.reportedAt), firstReportedKind: text(row.firstReportedKind), publishedAt: iso(row.publishedAt), collectedAt: iso(row.collectedAt), processedAt: iso(row.processedAt), firstVisibleAt: iso(row.firstVisibleAt), alertCreatedAt: iso(row.alertCreatedAt), deliveryAttemptedAt: iso(row.deliveryAttemptedAt), deliveredAt: iso(row.deliveredAt), latencies: compact({ publicationToCollectionSeconds: finiteNumber(latencies.publicationToCollectionSeconds), collectionToProcessingSeconds: finiteNumber(latencies.collectionToProcessingSeconds), processingToVisibilitySeconds: finiteNumber(latencies.processingToVisibilitySeconds), reportToVisibilitySeconds: finiteNumber(latencies.reportToVisibilitySeconds), visibilityToAlertSeconds: finiteNumber(latencies.visibilityToAlertSeconds), reportToAlertSeconds: finiteNumber(latencies.reportToAlertSeconds) }), timestampAnomalies: strings(row.timestampAnomalies), updatedAt: iso(row.updatedAt) }) }

function publicClaimValue(value: unknown) { const row = record(value); return compact({ title: text(row.title), summary: text(row.summary), type: text(row.type), value: text(row.value), normalizedValue: text(row.normalizedValue), company: text(row.company), victim: text(row.victim), datasetType: text(row.datasetType) }) }
function publicError(code: string, message: string, requestId: string) { return { code, message, requestId } }
function sendError(reply: FastifyReply, requestId: string, status: number, code: string, message: string) { return reply.status(status).send({ error: publicError(code, message, requestId) }) }

export function normalizeError(payload: unknown, status: number, requestId: string) {
    let body = payload
    if (typeof payload === 'string') { try { body = JSON.parse(payload) } catch { body = {} } }
    const input = record(body)
    const nested = record(input.error)
    if (Object.keys(nested).length) return { error: { code: text(nested.code) ?? statusCode(status), message: text(nested.message) ?? statusMessage(status), requestId } }
    const legacy = text(input.error)
    return { error: { code: legacy && /^[a-z0-9_]+$/.test(legacy) ? legacy : statusCode(status), message: text(input.message) ?? (legacy && !/^[a-z0-9_]+$/.test(legacy) ? legacy : statusMessage(status)), requestId } }
}

function statusCode(status: number) { return status === 400 ? 'invalid_request' : status === 401 ? 'authentication_required' : status === 403 ? 'scope_forbidden' : status === 404 ? 'not_found' : status === 429 ? 'rate_limit_exceeded' : status >= 500 ? 'internal_error' : 'request_failed' }
function statusMessage(status: number) { return status === 400 ? 'The request is invalid.' : status === 401 ? 'Authentication is required.' : status === 403 ? 'The credential does not permit this operation.' : status === 404 ? 'The requested resource was not found.' : status === 429 ? 'The request rate limit was exceeded.' : 'The request could not be completed.' }
function compact<T extends Record<string, unknown>>(value: T) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) }
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {} }
function array<T>(value: T[] | undefined): T[] { return Array.isArray(value) ? value : [] }
function arrayLength(value: unknown) { return Array.isArray(value) ? value.length : undefined }
function text(value: unknown) { return typeof value === 'string' && value.length ? value : undefined }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
function boundedIncidentText(value: unknown, maxLength = 200) { return text(value)?.slice(0, maxLength) }
function boundedIncidentStrings(value: unknown) { return strings(value).slice(0, 100).map(item => item.slice(0, 200)) }
function boundedIncidentInteger(value: unknown, maximum: number) { const number = nonNegativeInteger(value); return number !== undefined && number <= maximum ? number : undefined }
function boundedIncidentArrayLength(value: unknown, maximum: number) { const length = arrayLength(value); return length !== undefined && length <= maximum ? length : undefined }
function incidentEnum<const T extends string>(value: unknown, allowed: readonly T[]) { return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined }
function incidentIso(value: unknown) { const string = text(value); if (!string) return undefined; const timestamp = Date.parse(string); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined }
function publicIndicators(value: unknown) { return strings(value).filter(item => !/^https?:\/\//i.test(item) || httpUrl(item)) }
function boolean(value: unknown) { return typeof value === 'boolean' ? value : undefined }
function scalar(value: unknown) { return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : undefined }
function finiteNumber(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
    if (typeof value !== 'string' || !value.trim()) return undefined
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
function nonNegativeInteger(value: unknown) { const number = finiteNumber(value); return number !== undefined && Number.isInteger(number) && number >= 0 ? number : undefined }
function confidence(value: unknown) { const number = finiteNumber(value); return number === undefined ? undefined : Math.max(0, Math.min(1, number > 1 ? number / 100 : number)) }
function iso(value: unknown) { const string = text(value); return string && !Number.isNaN(Date.parse(string)) ? string : undefined }
function httpUrl(value: unknown) { const string = text(value); if (!string) return undefined; try { const parsed = new URL(string); return ['http:', 'https:'].includes(parsed.protocol) && !(parsed.hostname === 'news.google.com' && /^\/(?:rss\/)?articles\//.test(parsed.pathname)) ? parsed.toString() : undefined } catch { return undefined } }
