type Schema = Record<string, unknown>

const string = (extra: Schema = {}): Schema => ({ type: 'string', ...extra })
const number = (extra: Schema = {}): Schema => ({ type: 'number', ...extra })
const integer = (extra: Schema = {}): Schema => ({ type: 'integer', ...extra })
const boolean = (extra: Schema = {}): Schema => ({ type: 'boolean', ...extra })
const stringArray = (extra: Schema = {}): Schema => ({ type: 'array', items: string(), ...extra })
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` })
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}) })
const dateTime = (): Schema => string({ format: 'date-time' })
const confidence = (): Schema => number({ minimum: 0, maximum: 1 })
const nullableString = (): Schema => ({ type: ['string', 'null'] })

const errorResponses = {
    '400': { $ref: '#/components/responses/BadRequest' },
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
    '429': { $ref: '#/components/responses/RateLimited' },
    '500': { $ref: '#/components/responses/InternalError' },
    '503': { $ref: '#/components/responses/Unavailable' },
}

const paginationParameters = [
    { name: 'q', in: 'query', description: 'Case-insensitive text filter.', schema: string({ maxLength: 200 }) },
    { name: 'limit', in: 'query', description: 'Records per page.', schema: integer({ minimum: 1, maximum: 100, default: 50 }) },
    { name: 'cursor', in: 'query', description: 'Opaque cursor returned by the preceding page.', schema: string({ pattern: '^\\d+$' }) },
]

const resourceDefinitions = {
    '/actors': ['Actor', 'Actor intelligence profiles'],
    '/aliases': ['ActorAlias', 'Actor aliases linked to canonical profiles'],
    '/incidents': ['Incident', 'Structured incidents inferred from public evidence'],
    '/claims': ['Claim', 'Structured intelligence claims'],
    '/evidence': ['EvidenceLink', 'Capture-to-intelligence evidence links'],
    '/sources': ['Source', 'Governed public-intelligence sources'],
    '/validations': ['Validation', 'Public-reference validation records'],
    '/alerts': ['Alert', 'Metadata-safe threat alerts'],
    '/evaluation': ['EvaluationLabel', 'Independent evaluation labels'],
    '/timeliness': ['Timeliness', 'Collection and publication latency records'],
} as const

const schemas: Record<string, Schema> = {
    ErrorDetail: object({ code: string(), message: string(), requestId: string() }, ['code', 'message', 'requestId']),
    ErrorEnvelope: object({ error: ref('ErrorDetail') }, ['error']),
    Pagination: object({ limit: integer({ minimum: 1, maximum: 100 }), total: integer({ minimum: 0 }), nextCursor: nullableString() }, ['limit', 'total', 'nextCursor']),
    Meta: object({ requestId: string() }, ['requestId']),
    SearchRequest: object({ query: string({ minLength: 2, maxLength: 200, example: 'APT29' }) }, ['query']),
    BatchSearchRequest: object({ queries: { type: 'array', minItems: 1, maxItems: 25, items: string({ minLength: 2, maxLength: 200 }), example: ['APT29', 'CVE-2024-3094'] } }, ['queries']),
    Activity: object({
        date: string(), title: string(), detail: string(), confidence: confidence(), sourceIds: stringArray(), url: string({ format: 'uri' }), claimType: string(), victimName: string(), affectedSectors: stringArray(), countries: stringArray(), impact: string(), firstReportedAt: dateTime(), lastReportedAt: dateTime(), publisherCount: integer({ minimum: 0 }), corroboratingSourceIds: stringArray(), contradictingSourceIds: stringArray(),
    }, ['date', 'title', 'detail', 'confidence', 'sourceIds']),
    Target: object({ sector: string(), regions: stringArray(), rationale: string(), confidence: confidence() }, ['sector', 'regions', 'rationale', 'confidence']),
    Ttp: object({ name: string(), attackId: string(), tactic: string(), detail: string(), confidence: confidence() }, ['name', 'tactic', 'detail', 'confidence']),
    Dataset: object({ name: string(), type: string({ enum: ['clear_web', 'public_channel', 'darknet_metadata', 'vendor_report', 'stix_export'] }), coverage: string(), status: string({ enum: ['available', 'planned', 'metadata_only'] }), url: string({ format: 'uri' }) }, ['name', 'type', 'coverage', 'status']),
    SearchSource: object({ id: string(), name: string(), type: string(), provenance: string(), url: string({ format: 'uri' }), captureId: string(), sourceRequestId: string(), sourceFamily: string(), parserStatus: string(), reportDate: dateTime(), lastCollectedAt: dateTime() }, ['id', 'name', 'type', 'provenance']),
    ActorIntelligence: object({ actorClass: string(), attribution: string(), firstSeen: dateTime(), lastSeen: dateTime(), motivation: stringArray(), malwareTools: stringArray(), campaigns: stringArray(), infrastructure: stringArray(), targetSectors: stringArray(), geographies: stringArray(), confidence: confidence(), confidenceReasoning: stringArray(), sourceProvenance: stringArray() }),
    WatchlistCandidate: object({ kind: string({ enum: ['company', 'domain', 'vendor'] }), value: string(), reason: string(), confidence: confidence() }, ['kind', 'value', 'reason']),
    Actionability: object({ schemaVersion: string({ const: 'ti.query.actionability.v1' }), alertDisposition: string({ enum: ['ready_for_alert_review', 'watchlist_required', 'case_ready', 'not_alertable', 'needs_enrichment'] }), shouldAlert: boolean(), rationale: string(), watchlistCandidates: { type: 'array', items: ref('WatchlistCandidate') } }),
    SearchResult: object({
        query: string(), queryKind: string({ enum: ['actor', 'domain', 'cve', 'indicator', 'organization', 'free_text'] }), generatedAt: dateTime(), mode: string({ enum: ['scraper', 'seeded', 'live_search'] }), status: string({ enum: ['queued', 'searching', 'partial', 'ready', 'metadata_review', 'blocked_unsafe_target', 'needs_source_activation'] }), runId: string(), refreshAfterSeconds: integer({ minimum: 0 }), summary: string(), confidence: confidence(), lastSeen: string(), aliases: stringArray(), recentActivity: { type: 'array', items: ref('Activity') }, targets: { type: 'array', items: ref('Target') }, ttps: { type: 'array', items: ref('Ttp') }, datasets: { type: 'array', items: ref('Dataset') }, sources: { type: 'array', items: ref('SearchSource') }, notes: stringArray(), actorIntelligence: ref('ActorIntelligence'), actionability: ref('Actionability'),
    }, ['query', 'generatedAt', 'mode', 'summary', 'confidence', 'lastSeen', 'aliases', 'recentActivity', 'targets', 'ttps', 'datasets', 'sources', 'notes']),
    BatchSuccess: object({ query: string(), status: string({ const: 'ok' }), result: ref('SearchResult') }, ['query', 'status', 'result']),
    BatchFailure: object({ query: string(), status: string({ const: 'error' }), error: ref('ErrorDetail') }, ['query', 'status', 'error']),
    BatchSearchResponse: object({ generatedAt: dateTime(), count: integer({ minimum: 1, maximum: 25 }), partial: boolean(), results: { type: 'array', items: { oneOf: [ref('BatchSuccess'), ref('BatchFailure')] } } }, ['generatedAt', 'count', 'partial', 'results']),
    Actor: object({ id: string(), canonicalName: string(), normalizedName: string(), actorType: string(), aliases: stringArray(), confidence: confidence(), firstSeenAt: dateTime(), lastSeenAt: dateTime(), evidenceCount: integer({ minimum: 0 }), sourceIds: stringArray(), captureIds: stringArray(), reviewState: string(), updatedAt: dateTime() }, ['id', 'canonicalName', 'aliases', 'confidence', 'sourceIds', 'captureIds']),
    ActorAlias: object({ id: string(), actorProfileId: string(), alias: string(), normalizedAlias: string(), confidence: confidence(), firstSeenAt: dateTime(), lastSeenAt: dateTime(), evidenceCount: integer({ minimum: 0 }), sourceIds: stringArray(), updatedAt: dateTime() }, ['id', 'actorProfileId', 'alias', 'normalizedAlias', 'confidence', 'sourceIds']),
    Incident: object({ id: string(), sourceId: string(), captureId: string(), title: string(), summary: string(), firstSeenAt: dateTime(), confidence: confidence(), assertionKind: string({ const: 'inferred' }), reviewState: string(), extractorVersion: string(), reviewReasons: stringArray() }, ['id', 'sourceId', 'captureId', 'title', 'summary', 'confidence', 'assertionKind', 'reviewState', 'reviewReasons']),
    ClaimValue: object({ title: string(), summary: string(), type: string(), value: string(), normalizedValue: string(), company: string(), victim: string(), datasetType: string() }),
    Claim: object({ id: string(), claimType: string(), subjectType: string(), subjectId: string(), value: ref('ClaimValue'), summary: string(), confidence: confidence(), evidenceStage: string(), extractionMethod: string(), extractorVersion: string(), reviewState: string(), corroborationState: string(), sourceCount: integer({ minimum: 0 }), evidenceCount: integer({ minimum: 0 }), firstSeenAt: dateTime(), lastSeenAt: dateTime(), sourceIds: stringArray(), captureIds: stringArray(), uncertaintyReasons: stringArray(), legalHold: boolean(), retentionClass: string(), createdAt: dateTime(), updatedAt: dateTime() }, ['id', 'claimType', 'subjectType', 'subjectId', 'value', 'summary', 'confidence', 'reviewState', 'sourceIds', 'captureIds']),
    EvidenceLink: object({ id: string(), captureId: string(), subjectType: string(), subjectId: string(), relationship: string(), confidence: confidence(), extractorVersion: string(), createdAt: dateTime() }, ['id', 'captureId', 'subjectType', 'subjectId', 'relationship', 'confidence']),
    OperatingMode: object({ accessMethod: string(), metadataOnly: boolean(), approvalState: string(), policyVersion: string() }, ['accessMethod', 'metadataOnly', 'approvalState']),
    Publisher: object({ name: string(), country: string(), homepage: string({ format: 'uri' }), trustBasis: string() }, ['name']),
    Collection: object({ cadenceSeconds: integer({ minimum: 0 }), freshnessTargetSeconds: integer({ minimum: 0 }), lastSeenAt: dateTime(), createdAt: dateTime(), updatedAt: dateTime() }, ['cadenceSeconds']),
    Source: object({ id: string(), name: string(), type: string(), status: string(), risk: string(), trustScore: confidence(), language: string(), tags: stringArray(), url: string({ format: 'uri' }), urlHash: string(), locatorRedacted: boolean(), operatingMode: ref('OperatingMode'), publisher: ref('Publisher'), collection: ref('Collection') }, ['id', 'name', 'type', 'status', 'risk', 'trustScore', 'tags', 'urlHash', 'locatorRedacted', 'operatingMode', 'collection']),
    Validation: object({ id: string(), captureId: string(), incidentId: string(), claimId: string(), validationType: string(), status: string({ enum: ['supported', 'partially_supported', 'unconfirmed', 'contradicted'] }), referenceUrl: string({ format: 'uri' }), referencePublishedAt: dateTime(), matchedAt: dateTime(), reviewerId: string(), notes: string(), updatedAt: dateTime() }, ['id', 'validationType', 'status', 'referenceUrl', 'matchedAt']),
    AlertEvidence: object({ captureIds: stringArray(), sourceIds: stringArray(), evidenceCount: integer({ minimum: 0 }), sourceCount: integer({ minimum: 0 }), metadataOnly: boolean() }, ['captureIds', 'sourceIds', 'evidenceCount', 'sourceCount', 'metadataOnly']),
    Alert: object({ id: string(), incidentId: string(), actor: string(), victim: string(), assertionKind: string(), observedMatchSummary: string(), summary: string(), severity: string(), confidence: confidence(), reviewState: string(), workflowState: string(), deliveryState: string(), sourceFamily: string(), firstSeenAt: dateTime(), lastSeenAt: dateTime(), alertedAt: dateTime(), deliveredAt: dateTime(), evidence: ref('AlertEvidence') }, ['id', 'assertionKind', 'reviewState', 'evidence']),
    Scalar: { type: ['string', 'number', 'boolean', 'null'] },
    EvaluationLabel: object({ id: string(), captureId: string(), incidentId: string(), entityId: string(), indicatorId: string(), claimId: string(), labelType: string(), expectedValue: ref('Scalar'), observedValue: ref('Scalar'), outcome: string(), labeledBy: string(), labelingMethod: string(), independentFromExtractor: boolean(), labeledAt: dateTime(), datasetSplit: string({ enum: ['train', 'validation', 'test', 'unassigned'] }), notes: string(), updatedAt: dateTime() }, ['id', 'labelType', 'outcome', 'labeledBy', 'labelingMethod', 'labeledAt', 'datasetSplit']),
    Latencies: object({ publicationToCollectionSeconds: number(), collectionToProcessingSeconds: number(), processingToVisibilitySeconds: number(), reportToVisibilitySeconds: number(), visibilityToAlertSeconds: number(), reportToAlertSeconds: number() }),
    Timeliness: object({ id: string(), sourceId: string(), captureId: string(), incidentId: string(), firstReportedAt: dateTime(), reportedAt: dateTime(), firstReportedKind: string(), publishedAt: dateTime(), collectedAt: dateTime(), processedAt: dateTime(), firstVisibleAt: dateTime(), alertCreatedAt: dateTime(), deliveryAttemptedAt: dateTime(), deliveredAt: dateTime(), latencies: ref('Latencies'), timestampAnomalies: stringArray(), updatedAt: dateTime() }, ['id', 'sourceId', 'captureId', 'incidentId', 'timestampAnomalies']),
}

for (const [schemaName] of Object.values(resourceDefinitions)) {
    const responseName = `${schemaName}Collection`
    schemas[responseName] = object({ data: { type: 'array', items: ref(schemaName) }, pagination: ref('Pagination'), meta: ref('Meta') }, ['data', 'pagination', 'meta'])
}

const paths: Record<string, unknown> = {
    '/ti/search': {
        post: {
            operationId: 'searchThreatIntelligence',
            summary: 'Search public threat intelligence',
            description: 'One bounded search is available anonymously. Results are never shared-cacheable.',
            security: [],
            requestBody: { required: true, content: { 'application/json': { schema: ref('SearchRequest') } } },
            responses: { '200': jsonResponse('Search result', ref('SearchResult')), ...errorResponses },
        },
    },
    '/ti/search/batch': {
        post: {
            operationId: 'batchSearchThreatIntelligence',
            summary: 'Search up to 25 unique queries',
            description: 'Requires an API key or authenticated session. HTTP 207 reports per-query partial failures without disguising them as successful search results.',
            security: protectedSecurity(),
            requestBody: { required: true, content: { 'application/json': { schema: ref('BatchSearchRequest') } } },
            responses: { '200': jsonResponse('All searches completed', ref('BatchSearchResponse')), '207': jsonResponse('One or more searches failed', ref('BatchSearchResponse')), ...errorResponses },
        },
    },
}

for (const [path, [schemaName, summary]] of Object.entries(resourceDefinitions)) {
    paths[path] = {
        get: {
            operationId: `list${schemaName === 'EvidenceLink' ? 'Evidence' : schemaName === 'EvaluationLabel' ? 'EvaluationLabels' : `${schemaName}s`}`,
            summary,
            security: protectedSecurity(),
            parameters: paginationParameters,
            responses: { '200': jsonResponse(`${schemaName} page`, ref(`${schemaName}Collection`)), ...errorResponses },
        },
    }
}

export const publicTiOpenApi = {
    openapi: '3.1.0',
    info: {
        title: 'Hanasand Public Intelligence API',
        version: '1.0.0',
        description: 'Versioned, metadata-safe access to production-backed public intelligence. Version 1 is read-only: POST search operations are retrieval operations, and no mutation or idempotency-key contract is advertised.',
        'x-compatibility-policy': 'Additive fields and endpoints may be introduced within v1. Removing or changing existing fields, semantics, authentication, or pagination requires a new major API version.',
        'x-idempotency-policy': 'v1 exposes no public mutations. Search POSTs are retrieval-only and safe to retry; no Idempotency-Key header is required.',
    },
    servers: [{ url: 'https://api.hanasand.com/api/v1', description: 'Production' }],
    tags: [{ name: 'Search' }, { name: 'Intelligence' }],
    paths,
    components: {
        securitySchemes: {
            ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Provisioned key with an exact method and route scope.' },
            SessionBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'session-token' },
            SessionId: { type: 'apiKey', in: 'header', name: 'id', description: 'Session identifier required together with SessionBearer.' },
        },
        schemas,
        responses: {
            BadRequest: jsonResponse('Invalid input', ref('ErrorEnvelope')),
            Unauthorized: jsonResponse('Missing or invalid credentials', ref('ErrorEnvelope')),
            Forbidden: jsonResponse('Credential scope does not permit this operation', ref('ErrorEnvelope')),
            RateLimited: { ...jsonResponse('Rate limit exceeded', ref('ErrorEnvelope')), headers: { 'Retry-After': { schema: integer({ minimum: 1 }) }, 'X-Rate-Limit-Remaining': { schema: integer({ minimum: 0 }) }, 'X-Request-Id': { schema: string() } } },
            InternalError: jsonResponse('Unexpected request processing failure', ref('ErrorEnvelope')),
            Unavailable: jsonResponse('Upstream intelligence service unavailable', ref('ErrorEnvelope')),
        },
    },
} as const

function protectedSecurity() { return [{ ApiKey: [] }, { SessionBearer: [], SessionId: [] }] }
function jsonResponse(description: string, schema: Schema) { return { description, headers: { 'X-Request-Id': { schema: string() }, 'Cache-Control': { schema: string({ const: 'no-store, max-age=0' }) } }, content: { 'application/json': { schema } } } }
