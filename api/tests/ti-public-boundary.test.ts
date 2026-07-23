import { describe, expect, test } from 'bun:test'
import Fastify from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { isAllowedApiOrigin, verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { credentialPeriodLimits, resolveRateLimitActor } from '#plugins/rateLimit.ts'
import { organizationPublicApiScopes } from '#utils/auth/apiKeys.ts'
import postTiSearch, { normalizeBatchQueries, postTiSearchBatch, TI_BATCH_MAX_QUERIES } from '../src/handlers/ti/search.ts'
import { TRUSTED_API_PROXIES } from '../src/utils/http/publicBoundary.ts'
import { readFile } from 'node:fs/promises'

describe('public TI API boundary', () => {
    test('uses Fastify verified client IP instead of a caller-supplied forwarding header', () => {
        const request = { ip: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } } as unknown as FastifyRequest
        expect(verifiedClientIp(request)).toBe('203.0.113.10')
    })

    test('trusts forwarding only from explicitly configured proxy hops', async () => {
        const app = Fastify({ trustProxy: TRUSTED_API_PROXIES })
        app.get('/client-ip', request => ({ ip: request.ip }))

        const spoofed = await app.inject({ method: 'GET', url: '/client-ip', remoteAddress: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } })
        expect(spoofed.json()).toEqual({ ip: '203.0.113.10' })

        const proxied = await app.inject({ method: 'GET', url: '/client-ip', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '127.0.0.1, 198.51.100.7' } })
        expect(proxied.json()).toEqual({ ip: '198.51.100.7' })
        await app.close()
    })

    test('uses the same verified client identity for load-test quota and history', async () => {
        const [postHandler, listHandler] = await Promise.all([
            readFile(new URL('../src/handlers/test/post.ts', import.meta.url), 'utf8'),
            readFile(new URL('../src/handlers/test/list.ts', import.meta.url), 'utf8'),
        ])
        for (const handler of [postHandler, listHandler]) {
            expect(handler).toContain('verifiedClientIp(req)')
            expect(handler).not.toContain('req.headers[\'x-forwarded-for\']')
        }
    })

    test('does not grant internal limits to unauthenticated private proxy addresses', async () => {
        const request = { ip: '172.20.0.1', headers: {} } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request)).toEqual({ scope: 'anonymous', identifier: 'ip:172.20.0.1' })
    })

    test('marks an invalid presented API key instead of silently treating it as anonymous', async () => {
        const request = { ip: '203.0.113.10', headers: { 'x-api-key': 'hsk_invalid' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request, async () => null)).toEqual({ scope: 'anonymous', identifier: 'ip:203.0.113.10', invalidApiKey: true })
    })

    test('rejects malformed keys and expired sessions instead of downgrading them to anonymous', async () => {
        const malformedKey = { ip: '203.0.113.10', headers: { 'x-api-key': 'not-a-hanasand-key' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(malformedKey, async () => null)).toMatchObject({ invalidApiKey: true })

        const expiredSession = { ip: '203.0.113.10', headers: { authorization: 'Bearer expired', id: 'session-id' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(expiredSession, async () => null, async () => null)).toEqual({ scope: 'anonymous', identifier: 'ip:203.0.113.10', invalidSession: true })
    })

    test('requires both the internal tier and an exact administrator role for internal limits', async () => {
        const request = { ip: '203.0.113.10', headers: { 'x-api-key': 'hsk_test' } } as unknown as FastifyRequest
        const externalAdmin = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'business' }, roles: [{ id: 'admin', name: 'Admin' }] }) as any)
        expect(externalAdmin.scope).toBe('authenticated')

        const misleadingRole = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'internal' }, roles: [{ id: 'admin_assistant', name: 'Admin assistant' }] }) as any)
        expect(misleadingRole.scope).toBe('authenticated')

        const internalAdmin = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'internal' }, roles: [{ id: 'admin', name: 'Admin' }] }) as any)
        expect(internalAdmin.scope).toBe('internal')
    })

    test('applies the documented durable batch budget equally to sessions and API keys', () => {
        const apiKeyScope = organizationPublicApiScopes().find(scope => scope.route === '/api/v1/ti/search/batch')!
        const request = { method: 'POST', route: '/api/v1/ti/search/batch' }
        expect(credentialPeriodLimits({ actorIdentifier: 'user:customer', apiKeyScope: null, ...request })).toEqual(apiKeyScope.limits)
        expect(credentialPeriodLimits({ actorIdentifier: 'api_key:key', apiKeyScope, ...request })).toEqual(apiKeyScope.limits)
        expect(credentialPeriodLimits({ actorIdentifier: 'user:customer', apiKeyScope: null, method: 'GET', route: '/api/v1/actors' })).toBeNull()
    })

    test('allows only configured browser origins', () => {
        expect(isAllowedApiOrigin(undefined)).toBe(true)
        expect(isAllowedApiOrigin('https://hanasand.com')).toBe(true)
        expect(isAllowedApiOrigin('https://customer.example', 'https://customer.example')).toBe(true)
        expect(isAllowedApiOrigin('https://attacker.example')).toBe(false)
    })

    test('never shared-caches API responses or upstream failures in Varnish', async () => {
        const vcl = await readFile(new URL('../default.vcl', import.meta.url), 'utf8')
        expect(vcl).toContain('if (req.url ~ "^/api/")')
        expect(vcl).toContain('bereq.url ~ "^/api/" || beresp.status >= 400')
        expect(vcl).toContain('set beresp.http.Cache-Control = "no-store, max-age=0"')
        expect(vcl).not.toContain('set req.http.X-Forwarded-For')
    })

    test('normalizes unique bounded queries', () => {
        expect(normalizeBatchQueries([' APT29 ', 'apt29', 'CVE-2024-3094', '', 12])).toEqual(['APT29', 'CVE-2024-3094'])
        expect(normalizeBatchQueries(['x', 'x'.repeat(201)])).toEqual([])
    })

    test('allows one anonymous read-only search while protecting batch search', async () => {
        const single = reply()
        const singleResult = await postTiSearch({ body: { query: 'APT29' } } as FastifyRequest<{ Body: { query: string } }>, single as unknown as FastifyReply) as any
        expect(singleResult.statusCode).toBe(200)
        expect(singleResult.payload.query).toBe('APT29')
        expect(singleResult.headers['cache-control']).toBe('no-store, max-age=0')

        const unexpected = reply()
        const unexpectedResult = await postTiSearch({ body: { query: 'APT29', tenantId: 'other' } } as any, unexpected as unknown as FastifyReply) as any
        expect(unexpectedResult.statusCode).toBe(400)
        expect(unexpectedResult.payload.error).toBe('invalid_request')

        const anonymous = reply()
        const anonymousResult = await postTiSearchBatch({ body: { queries: ['APT29'] } } as FastifyRequest<{ Body: { queries: string[] } }>, anonymous as unknown as FastifyReply) as any
        expect(anonymousResult.statusCode).toBe(401)
        expect(anonymousResult.payload.error).toBe('authentication_required')
        expect(anonymousResult.headers['cache-control']).toBe('no-store, max-age=0')

        const authenticated = reply()
        const queries = Array.from({ length: TI_BATCH_MAX_QUERIES + 1 }, (_, index) => `actor-${index}`)
        const oversizedResult = await postTiSearchBatch({ body: { queries }, apiKeyAuth: {} } as any, authenticated as unknown as FastifyReply) as any
        expect(oversizedResult.statusCode).toBe(400)
        expect(oversizedResult.payload.error).toBe('too_many_queries')

        const duplicateFlood = reply()
        const duplicateFloodResult = await postTiSearchBatch({ body: { queries: Array(TI_BATCH_MAX_QUERIES + 1).fill('APT29') }, apiKeyAuth: {} } as any, duplicateFlood as unknown as FastifyReply) as any
        expect(duplicateFloodResult.statusCode).toBe(400)
        expect(duplicateFloodResult.payload.error).toBe('too_many_queries')
    })
})

function reply() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        status(code: number) { this.statusCode = code; return this },
        header(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this },
        send(payload: unknown) { return { statusCode: this.statusCode, headers: this.headers, payload } },
    }
}
