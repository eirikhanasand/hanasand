import { afterEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import Ajv2020 from 'ajv/dist/2020.js'
import publicTiApi, { normalizeError } from '../src/handlers/ti/publicApi.ts'
import { publicTiOpenApi } from '../src/contracts/publicTiOpenApi.ts'
import { createPublicTiClient } from '../sdk/publicTiClient.ts'

const apps: FastifyInstance[] = []
const searchResult = {
    query: 'APT29', generatedAt: '2026-07-22T10:00:00.000Z', mode: 'scraper' as const, status: 'ready' as const, summary: 'Current public evidence for APT29.', confidence: 0.9, lastSeen: '2026-07-22T09:00:00.000Z', aliases: ['Cozy Bear'],
    recentActivity: [], targets: [], ttps: [], datasets: [], sources: [{ id: 'src-1', name: 'Public report', type: 'rss', provenance: 'publisher', url: 'https://example.test/report' }], notes: [],
}

afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())))

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
        expect(JSON.stringify(spec)).not.toContain('additionalProperties":true')
    })

    test('keeps single search anonymous and returns stable request-correlated failures', async () => {
        const app = await testApp()
        const success = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(success.statusCode).toBe(200)
        expect(success.json().query).toBe('APT29')
        expect(success.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)

        const invalid = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'x', tenantId: 'forbidden' } })
        expect(invalid.statusCode).toBe(400)
        expect(invalid.json()).toEqual({ error: { code: 'invalid_query', message: 'query must contain 2-200 characters.', requestId: invalid.headers['x-request-id'] } })
    })

    test('protects collections and returns typed cursor pages without forwarding tenant scope', async () => {
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
        expect(response.json()).toEqual({ data: [{ id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'] }], pagination: { limit: 10, total: 1, nextCursor: null }, meta: { requestId: response.headers['x-request-id'] } })
        expect(requestedUrl).toContain('/v1/intel/actor-profiles?')
        expect(requestedUrl).not.toContain('tenant')

        const invalid = await app.inject({ method: 'GET', url: '/api/v1/actors?limit=101', headers: { 'x-api-key': 'valid' } })
        expect(invalid.statusCode).toBe(400)
        expect(invalid.json().error.code).toBe('invalid_pagination')
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
        if (request.headers['x-api-key'] === 'valid') (request as any).apiKeyAuth = { id: 'test-key' }
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
