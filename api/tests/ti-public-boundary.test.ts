import { describe, expect, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { isAllowedApiOrigin } from '#utils/http/publicBoundary.ts'
import { getClientIp, resolveRateLimitActor } from '#plugins/rateLimit.ts'
import postTiSearch, { normalizeBatchQueries, postTiSearchBatch, TI_BATCH_MAX_QUERIES } from '../src/handlers/ti/search.ts'

describe('public TI API boundary', () => {
    test('uses Fastify verified client IP instead of a caller-supplied forwarding header', () => {
        const request = { ip: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } } as unknown as FastifyRequest
        expect(getClientIp(request)).toBe('203.0.113.10')
    })

    test('does not grant internal limits to unauthenticated private proxy addresses', async () => {
        const request = { ip: '172.20.0.1', headers: {} } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request)).toEqual({ scope: 'anonymous', identifier: 'ip:172.20.0.1' })
    })

    test('marks an invalid presented API key instead of silently treating it as anonymous', async () => {
        const request = { ip: '203.0.113.10', headers: { 'x-api-key': 'hsk_invalid' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request, async () => null)).toEqual({ scope: 'anonymous', identifier: 'ip:203.0.113.10', invalidApiKey: true })
    })

    test('allows only configured browser origins', () => {
        expect(isAllowedApiOrigin(undefined)).toBe(true)
        expect(isAllowedApiOrigin('https://hanasand.com')).toBe(true)
        expect(isAllowedApiOrigin('https://customer.example', 'https://customer.example')).toBe(true)
        expect(isAllowedApiOrigin('https://attacker.example')).toBe(false)
    })

    test('normalizes unique bounded queries', () => {
        expect(normalizeBatchQueries([' APT29 ', 'apt29', 'CVE-2024-3094', '', 12])).toEqual(['APT29', 'CVE-2024-3094'])
        expect(normalizeBatchQueries(['x', 'x'.repeat(201)])).toEqual([])
    })

    test('requires authentication and rejects oversized batches before search work starts', async () => {
        const single = reply()
        const singleResult = await postTiSearch({ body: { query: 'APT29' } } as FastifyRequest<{ Body: { query: string } }>, single as unknown as FastifyReply) as any
        expect(singleResult.statusCode).toBe(401)
        expect(singleResult.payload.error).toBe('authentication_required')

        const unexpected = reply()
        const unexpectedResult = await postTiSearch({ body: { query: 'APT29', tenantId: 'other' }, apiKeyAuth: {} } as any, unexpected as unknown as FastifyReply) as any
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
