import { describe, expect, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { isAllowedApiOrigin } from '#utils/http/publicBoundary.ts'
import { getClientIp } from '#plugins/rateLimit.ts'
import { normalizeBatchQueries, postTiSearchBatch, TI_BATCH_MAX_QUERIES } from '../src/handlers/ti/search.ts'

describe('public TI API boundary', () => {
    test('uses Fastify verified client IP instead of a caller-supplied forwarding header', () => {
        const request = { ip: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } } as unknown as FastifyRequest
        expect(getClientIp(request)).toBe('203.0.113.10')
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
