import { afterEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import Ajv2020 from 'ajv/dist/2020.js'
import publicTiApi, { normalizeError } from '../src/handlers/ti/publicApi.ts'
import { publicTiOpenApi } from '../src/contracts/publicTiOpenApi.ts'
import { createPublicTiClient } from '../sdk/publicTiClient.ts'

const apps: FastifyInstance[] = []
const originalScraperApiBase = process.env.TI_SCRAPER_API_BASE
const searchResult = {
    query: 'APT29', generatedAt: '2026-07-22T10:00:00.000Z', mode: 'scraper' as const, status: 'ready' as const, summary: 'Current public evidence for APT29.', confidence: 0.9, lastSeen: '2026-07-22T09:00:00.000Z', aliases: ['Cozy Bear'],
    recentActivity: [], targets: [], ttps: [{ name: 'Spearphishing Attachment', tactic: 'Initial Access', detail: 'Source-specific extraction.', confidence: 0.9, extractionMethod: 'source_specific', extractorVersion: 'vendor-parser-v1' }], datasets: [], sources: [{ id: 'src-1', name: 'Public report', type: 'rss', provenance: 'publisher', url: 'https://example.test/report' }], notes: [],
    actorIntelligence: { infrastructure: ['https://news.google.com/rss/articles/opaque-aggregator-id?oc=5', '203.0.113.10', 'https://infra.example.test/path'] },
}

afterEach(async () => {
    await Promise.all(apps.splice(0).map(app => app.close()))
    if (originalScraperApiBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalScraperApiBase
})

describe('public TI v1', () => {
    test('publishes the implemented versioned contract without fake mutation resources', async () => {
        const app = await testApp()
        const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
        const spec = response.json()
        expect(spec.openapi).toBe('3.1.0')
        expect(Object.keys(spec.paths)).toEqual(['/ti/search', '/ti/search/batch', '/actors', '/aliases', '/incidents', '/claims', '/evidence', '/sources', '/validations', '/alerts', '/evaluation', '/timeliness'])
        expect(spec.paths['/ti/search'].post.security).toEqual([])
        expect(spec.paths['/actors'].get.security).toEqual([{ ApiKey: [] }, { SessionBearer: [], SessionId: [] }])
        expect(spec.paths['/alerts'].get.security).toEqual([{ ApiKey: [] }])
        expect(spec.components.schemas.SearchResult.required).not.toContain('lastSeen')
        for (const name of ['ActorAttributionProvenance', 'IncidentActorAttribution', 'ModelRuntimeIdentity', 'IncidentAutomaticReview', 'Incident', 'Validation']) {
            const fields = Object.keys(spec.components.schemas[name].properties)
            for (const forbidden of ['taskId', 'requestSha256', 'reviewerId', 'identityId', 'client', 'conversationId', 'supportingEvidenceIds', 'selectedEvidenceIds', 'reviewReasons']) {
                expect(fields).not.toContain(forbidden)
            }
        }
        const incidentFields = Object.keys(spec.components.schemas.Incident.properties)
        expect(incidentFields).not.toContain('sourceId')
        expect(incidentFields).not.toContain('captureId')
        expect(JSON.stringify(spec)).not.toContain('additionalProperties":true')
    })

    test('keeps single search anonymous and returns stable request-correlated failures', async () => {
        const app = await testApp()
        const success = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(success.statusCode).toBe(200)
        expect(success.json().query).toBe('APT29')
        expect(success.json().ttps).toEqual([expect.objectContaining({ extractionMethod: 'source_specific', extractorVersion: 'vendor-parser-v1' })])
        expect(success.json().actorIntelligence.infrastructure).toEqual(['203.0.113.10', 'https://infra.example.test/path'])
        expect(success.body).not.toContain('news.google.com/rss/articles')
        expect(success.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)

        const invalid = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'x', tenantId: 'forbidden' } })
        expect(invalid.statusCode).toBe(400)
        expect(invalid.json()).toEqual({ error: { code: 'invalid_query', message: 'query must contain 2-200 characters.', requestId: invalid.headers['x-request-id'] } })
    })

    test('protects global collections and returns typed cursor pages without accepting caller tenant scope', async () => {
        let requestedUrl = ''
        const app = await testApp(async input => {
            requestedUrl = String(input)
            return Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'], privateField: 'must-not-leak' }], total: 1 })
        })

        const anonymous = await app.inject({ method: 'GET', url: '/api/v1/actors' })
        expect(anonymous.statusCode).toBe(401)
        expect(anonymous.json().error.code).toBe('authentication_required')

        const response = await app.inject({ method: 'GET', url: '/api/v1/actors?q=apt&limit=10&cursor=0', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ data: [{ id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'] }], pagination: { limit: 10, total: 1, nextCursor: null }, meta: { requestId: response.headers['x-request-id'], organizationId: 'org-customer' } })
        expect(requestedUrl).toContain('/v1/intel/actor-profiles?')
        expect(requestedUrl).not.toContain('tenant')

        const invalid = await app.inject({ method: 'GET', url: '/api/v1/actors?limit=101', headers: { 'x-api-key': 'valid' } })
        expect(invalid.statusCode).toBe(400)
        expect(invalid.json().error.code).toBe('invalid_pagination')
    })

    test('derives alert tenant scope from the API key and ignores caller-selected tenant headers', async () => {
        let tenantHeader = ''
        const app = await testApp(async (_input, init) => {
            tenantHeader = new Headers(init?.headers).get('x-tenant-id') ?? ''
            return Response.json({ alerts: [{ id: 'alert-1', assertionKind: 'observed', reviewState: 'unreviewed', evidence: { captureIds: [], sourceIds: [], evidenceCount: 0, sourceCount: 0, metadataOnly: true } }], total: 1 })
        })

        const unbound = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: { 'x-api-key': 'global', 'x-tenant-id': 'other-org' } })
        expect(unbound.statusCode).toBe(403)
        expect(unbound.json().error.code).toBe('organization_scope_required')

        const response = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: { 'x-api-key': 'valid', 'x-tenant-id': 'other-org' } })
        expect(response.statusCode).toBe(200)
        expect(tenantHeader).toBe('org-customer')
        expect(response.json().meta.organizationId).toBe('org-customer')
    })

    test('publishes governed incident attribution and automatic-review lineage without attributing ambiguous decisions', async () => {
        const baseIncident = {
            sourceId: 'internal-source-id-must-not-leak',
            captureId: 'internal-capture-id-must-not-leak',
            title: 'Governed incident',
            summary: 'Safe summary',
            confidence: 0.9,
            assertionKind: 'inferred',
            reviewReasons: ['internal-review-note-must-not-leak'],
            notes: ['internal-incident-note-must-not-leak'],
        }
        const automaticReview = {
            taskId: 'internal-task-must-not-leak',
            requestSha256: 'internal-request-hash-must-not-leak',
            reviewerId: 'internal-automatic-reviewer-must-not-leak',
            modelStrategy: 'internal-model-strategy-must-not-leak',
            reasons: ['internal-automatic-reason-must-not-leak'],
            configuredModelVersion: 'hanasand-v1',
            runtimeIdentity: { status: 'completed', provider: 'hanasand-ai', model: 'hanasand-inspur', client: 'internal-client-must-not-leak', conversationId: 'internal-conversation-must-not-leak' },
            promptVersion: 'prompt.v1',
            responseSchemaVersion: 'response.v1',
            evidenceProjectionSchema: 'evidence.v1',
            selectedEvidenceIds: ['internal-selected-evidence-must-not-leak'],
            linkedEvidenceCount: 1,
            linkedSourceCount: 1,
            linkedIndependentSourceCount: 1,
            reviewedAt: '2026-07-23T10:00:00.000Z',
            action: 'confirm',
            claimValidity: 'supported',
            confidence: 0.92,
        }
        const app = await testApp(async () => Response.json({
            incidents: [
                {
                    ...baseIncident,
                    id: 'incident-confirmed',
                    reviewState: 'confirmed',
                    actorAttribution: {
                        identityId: 'actor-apt29',
                        externalId: 'G0016',
                        catalogId: 'mitre-enterprise',
                        canonicalName: 'APT29',
                        aliases: ['Midnight Blizzard'],
                        supportingEvidenceIds: ['internal-supporting-evidence-must-not-leak'],
                        provenance: {
                            taskId: 'internal-attribution-task-must-not-leak',
                            requestSha256: 'internal-attribution-hash-must-not-leak',
                            reviewerId: 'internal-reviewer-must-not-leak',
                            promptVersion: 'prompt.v1',
                        },
                    },
                    automaticReview,
                },
                {
                    ...baseIncident,
                    id: 'incident-ambiguous',
                    reviewState: 'needs_review',
                    actorAttribution: null,
                    automaticReview: { ...automaticReview, action: 'mark_needs_review', claimValidity: 'uncertain', confidence: 0.4 },
                },
                {
                    ...baseIncident,
                    id: 'incident-negative',
                    reviewState: 'rejected',
                    actorAttribution: {
                        identityId: 'must-not-leak',
                        canonicalName: 'Unconfirmed actor',
                        aliases: [],
                        supportingEvidenceIds: [],
                        provenance: { reviewerId: 'internal-negative-reviewer-must-not-leak' },
                    },
                    automaticReview: { ...automaticReview, action: 'reject', claimValidity: 'invalid', confidence: 0.2 },
                },
            ],
            total: 3,
        }))
        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(200)
        const body = response.json()
        expect(body.data[0]).toMatchObject({
            id: 'incident-confirmed',
            actorAttribution: {
                externalId: 'G0016',
                catalogId: 'mitre-enterprise',
                canonicalName: 'APT29',
                aliases: ['Midnight Blizzard'],
                supportingEvidenceCount: 1,
                provenance: { promptVersion: 'prompt.v1' },
            },
            automaticReview: {
                configuredModelVersion: 'hanasand-v1',
                runtimeIdentity: { status: 'completed', provider: 'hanasand-ai', model: 'hanasand-inspur' },
                linkedEvidenceCount: 1,
                linkedSourceCount: 1,
                linkedIndependentSourceCount: 1,
            },
        })
        expect(body.data[1].actorAttribution).toBeNull()
        expect(body.data[2].actorAttribution).toBeNull()
        const serialized = JSON.stringify(body)
        for (const forbidden of [
            'internal-task-must-not-leak',
            'internal-request-hash-must-not-leak',
            'internal-client-must-not-leak',
            'internal-conversation-must-not-leak',
            'internal-selected-evidence-must-not-leak',
            'internal-supporting-evidence-must-not-leak',
            'internal-attribution-task-must-not-leak',
            'internal-attribution-hash-must-not-leak',
            'internal-reviewer-must-not-leak',
            'internal-negative-reviewer-must-not-leak',
            'internal-review-note-must-not-leak',
            'internal-incident-note-must-not-leak',
            'internal-automatic-reviewer-must-not-leak',
            'internal-model-strategy-must-not-leak',
            'internal-automatic-reason-must-not-leak',
            'internal-source-id-must-not-leak',
            'internal-capture-id-must-not-leak',
        ]) expect(serialized).not.toContain(forbidden)
        expect(validateResponse('/incidents', 'get', 200, body)).toBe(true)
    })

    test('structurally bounds public incident strings, arrays, enums, counts, and finite values', async () => {
        const oversized = 'x'.repeat(5_000)
        const app = await testApp(async () => Response.json({
            incidents: [{
                id: oversized,
                title: oversized,
                summary: oversized,
                firstSeenAt: 'not-a-date',
                confidence: Number.POSITIVE_INFINITY,
                reviewState: 'confirmed',
                actorAttribution: {
                    identityId: 'actor-1',
                    canonicalName: oversized,
                    aliases: Array.from({ length: 101 }, () => oversized),
                    supportingEvidenceCount: 101,
                    supportingEvidenceIds: Array.from({ length: 101 }, (_, index) => `internal-${index}`),
                    provenance: { promptVersion: oversized },
                },
                automaticReview: {
                    configuredModelVersion: oversized,
                    runtimeIdentity: { status: 'internal_pending', provider: oversized, model: oversized },
                    linkedEvidenceCount: 100_001,
                    linkedSourceCount: Number.NaN,
                    linkedIndependentSourceCount: -1,
                    action: 'internal_action',
                    claimValidity: 'internal_validity',
                    confidence: Number.NEGATIVE_INFINITY,
                    notes: [oversized],
                    modelStrategy: oversized,
                },
                extractorVersion: oversized,
            }],
            total: 1,
        }))

        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        const body = response.json()
        const incident = body.data[0]
        expect(incident.id).toHaveLength(200)
        expect(incident.title).toHaveLength(500)
        expect(incident.summary).toHaveLength(4000)
        expect(incident.reviewState).toBe('confirmed')
        expect(incident.extractorVersion).toHaveLength(200)
        expect(incident.actorAttribution.canonicalName).toHaveLength(200)
        expect(incident.actorAttribution.aliases).toHaveLength(100)
        expect(incident.actorAttribution.aliases.every((alias: string) => alias.length === 200)).toBe(true)
        expect(incident.actorAttribution.supportingEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.configuredModelVersion).toHaveLength(200)
        expect(incident.automaticReview.runtimeIdentity).toBeUndefined()
        expect(incident.automaticReview.linkedEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedSourceCount).toBeUndefined()
        expect(incident.automaticReview.linkedIndependentSourceCount).toBeUndefined()
        expect(incident.automaticReview.action).toBeUndefined()
        expect(incident.automaticReview.claimValidity).toBeUndefined()
        expect(incident.automaticReview.confidence).toBeUndefined()
        expect(incident.firstSeenAt).toBeUndefined()
        expect(incident.confidence).toBeUndefined()
        expect(JSON.stringify(incident)).not.toContain('modelStrategy')
        expect(JSON.stringify(incident)).not.toContain('notes')
        expect(validateResponse('/incidents', 'get', 200, body)).toBe(true)
    })

    test('omits missing incident metrics and accepts only explicit finite numeric values', async () => {
        const app = await testApp(async input => {
            const path = new URL(String(input)).pathname
            if (path.endsWith('/incidents')) return Response.json({
                incidents: [{
                    id: 'incident-missing-metrics',
                    sourceId: 'source-1',
                    captureId: 'capture-1',
                    title: 'Incident without fabricated metrics',
                    summary: 'Missing numbers stay missing.',
                    confidence: null,
                    assertionKind: 'inferred',
                    reviewState: 'confirmed',
                    reviewReasons: [],
                    actorAttribution: {
                        identityId: 'actor-1',
                        canonicalName: 'APT29',
                        aliases: [],
                        supportingEvidenceCount: '',
                        provenance: { promptVersion: 'prompt.v1' },
                    },
                    automaticReview: {
                        configuredModelVersion: 'hanasand-v1',
                        linkedEvidenceCount: '',
                        linkedSourceCount: null,
                        linkedIndependentSourceCount: 'not-a-number',
                        confidence: '',
                    },
                }],
                total: 1,
            })
            return Response.json({
                timeliness: [{
                    id: 'timeliness-missing-metrics',
                    sourceId: 'source-1',
                    captureId: 'capture-1',
                    incidentId: 'incident-missing-metrics',
                    latencies: {
                        publicationToCollectionSeconds: null,
                        collectionToProcessingSeconds: '',
                        processingToVisibilitySeconds: '12.5',
                        reportToVisibilitySeconds: Number.POSITIVE_INFINITY,
                    },
                    timestampAnomalies: [],
                }],
                total: 1,
            })
        })

        const incidentResponse = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        const incidentBody = incidentResponse.json()
        const incident = incidentBody.data[0]
        expect(incident.confidence).toBeUndefined()
        expect(incident.actorAttribution.supportingEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedSourceCount).toBeUndefined()
        expect(incident.automaticReview.linkedIndependentSourceCount).toBeUndefined()
        expect(incident.automaticReview.confidence).toBeUndefined()
        expect(validateResponse('/incidents', 'get', 200, incidentBody)).toBe(true)

        const timelinessResponse = await app.inject({ method: 'GET', url: '/api/v1/timeliness', headers: { 'x-api-key': 'valid' } })
        const timeliness = timelinessResponse.json().data[0]
        expect(timeliness.latencies).toEqual({ processingToVisibilitySeconds: 12.5 })
        expect(JSON.stringify(timeliness)).not.toContain(':0')
        expect(validateResponse('/timeliness', 'get', 200, timelinessResponse.json())).toBe(true)
    })

    test('reports batch partial failures explicitly instead of returning fake searching results', async () => {
        const app = await testApp(undefined, async ({ query }) => {
            if (query === 'FAIL') throw new Error('upstream failure')
            return { ...searchResult, query }
        })
        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search/batch', headers: { 'x-api-key': 'valid' }, payload: { queries: ['APT29', 'FAIL'] } })
        expect(response.statusCode).toBe(207)
        expect(response.json().partial).toBe(true)
        expect(response.json().results[0].status).toBe('ok')
        expect(response.json().results[1]).toMatchObject({ query: 'FAIL', status: 'error', error: { code: 'search_unavailable' } })
    })

    test('returns a truthful unavailable response when the structured store cannot be reached', async () => {
        const app = await testApp(async () => new Response('offline', { status: 503 }))
        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(503)
        expect(response.json().error.code).toBe('upstream_unavailable')
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
    })

    test('validates representative successes and errors against the published OpenAPI', async () => {
        const app = await testApp(async () => Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: [], confidence: 0.8, sourceIds: [], captureIds: [] }], total: 1 }))
        const responses = [
            ['/ti/search', 'post', await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })],
            ['/ti/search', 'post', await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'x' } })],
            ['/actors', 'get', await app.inject({ method: 'GET', url: '/api/v1/actors' })],
            ['/actors', 'get', await app.inject({ method: 'GET', url: '/api/v1/actors?limit=1', headers: { 'x-api-key': 'valid' } })],
        ] as const
        for (const [path, method, response] of responses) expect(validateResponse(path, method, response.statusCode, response.json())).toBe(true)
    })

    test('the generated client performs authenticated success, error, and pagination calls', async () => {
        const app = await testApp(async () => Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: [], confidence: 0.8, sourceIds: [], captureIds: [] }], total: 1 }))
        const anonymous = createPublicTiClient({ baseUrl: 'http://api.test/api/v1', fetch: injectedFetch(app) })
        const protectedCall = await anonymous.GET('/actors', { params: { query: { limit: 1 } } })
        expect(protectedCall.response.status).toBe(401)
        expect(protectedCall.error?.error.code).toBe('authentication_required')

        const authenticated = createPublicTiClient({ baseUrl: 'http://api.test/api/v1', apiKey: 'valid', fetch: injectedFetch(app) })
        const page = await authenticated.GET('/actors', { params: { query: { limit: 1, cursor: '0' } } })
        expect(page.error).toBeUndefined()
        expect(page.data?.data[0]?.canonicalName).toBe('APT29')
        expect(page.data?.pagination).toEqual({ limit: 1, total: 1, nextCursor: null })
    })

    test('normalizes legacy rate-limit responses into the stable error contract', () => {
        const response = normalizeError(JSON.stringify({ error: 'Rate limit exceeded.' }), 429, 'request-1')
        expect(response).toEqual({ error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded.', requestId: 'request-1' } })
        expect(validateResponse('/actors', 'get', 429, response)).toBe(true)
    })
})

async function testApp(fetchImpl: typeof fetch = async () => Response.json({}), searchImpl: any = async () => searchResult) {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example.test'
    const app = Fastify({ genReqId: () => crypto.randomUUID() })
    app.addHook('preHandler', async request => {
        if (request.headers['x-api-key'] === 'valid') (request as any).apiKeyAuth = { organizationId: 'org-customer', apiKey: { organizationId: 'org-customer' } }
        if (request.headers['x-api-key'] === 'global') (request as any).apiKeyAuth = { organizationId: null, apiKey: { organizationId: null } }
    })
    await app.register(publicTiApi, { prefix: '/api/v1', fetchImpl, searchImpl })
    apps.push(app)
    return app
}

function injectedFetch(app: FastifyInstance): typeof fetch {
    return async input => {
        const request = input instanceof Request ? input : new Request(input)
        const response = await app.inject({ method: request.method as any, url: request.url, headers: Object.fromEntries(request.headers), payload: request.body ? await request.text() : undefined })
        return new Response(response.body, { status: response.statusCode, headers: response.headers as HeadersInit })
    }
}

function validateResponse(path: string, method: string, status: number, body: unknown) {
    const operation = (publicTiOpenApi.paths as Record<string, any>)[path][method]
    const rawResponse = operation.responses[String(status)]
    const response = rawResponse.$ref ? resolveRef(rawResponse.$ref) : rawResponse
    const schema = response.content['application/json'].schema
    const ajv = new Ajv2020({ strict: false, formats: { 'date-time': true, uri: true } })
    ajv.addSchema(publicTiOpenApi, 'contract')
    const validate = ajv.compile(schema.$ref ? { $ref: `contract${schema.$ref}` } : schema)
    if (!validate(body)) throw new Error(ajv.errorsText(validate.errors))
    return true
}

function resolveRef(pointer: string) {
    return pointer.replace(/^#\//, '').split('/').reduce<any>((value, part) => value[part], publicTiOpenApi)
}
