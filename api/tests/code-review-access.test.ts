import { test, expect, mock } from 'bun:test'
import Fastify from 'fastify'

mock.module('../src/constants.ts', () => ({ default: { vm_api_token: 'code-access-test-token' } }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async() => null }))
mock.module('../src/utils/db.ts', () => ({ default: async() => ({ rows: [] }), queryOnce: async() => ({ rows: [] }), withTransaction: async() => {}, isTransientDatabaseError: () => false }))
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/rateLimit/config.ts', () => ({
    registerRateLimitRoute: () => {}, resetSharedRateLimitBuckets: async() => {}, consumeSharedRateLimitBucket: async() => {},
    getRateLimitSettings: async() => ({ enabled: false }),
}))
mock.module('../src/utils/auth/apiKeys.ts', () => ({ organizationPublicApiScopes: () => [], matchApiKeyScope: () => null, validateApiKey: async() => null }))
const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const { getCodeReviews, postCodeReview } = await import('../src/handlers/codeReviews.ts')

test('internal read access cannot approve reviews; anonymous and invalid tokens remain blocked', async() => {
    const app = Fastify()
    app.get('/reviews', getCodeReviews)
    app.post('/reviews', postCodeReview)
    try {
        for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
            expect((await app.inject({ method: 'GET', url: '/reviews', headers })).statusCode).toBe(403)
        }
        const headers = { authorization: 'Bearer code-access-test-token' }
        expect((await app.inject({ method: 'GET', url: '/reviews', headers })).statusCode).toBe(200)
        expect((await app.inject({ method: 'GET', url: '/reviews?id=source:file.ts', headers })).statusCode).toBe(200)
        expect((await app.inject({ method: 'GET', url: '/reviews?before=invalid', headers })).statusCode).toBe(400)
        expect((await app.inject({ method: 'POST', url: '/reviews', headers, payload: {} })).statusCode).toBe(403)
    } finally { await app.close() }
})

test('the real authentication pre-handler accepts only the internal review GET', async() => {
    const app = Fastify()
    await app.register(rateLimit)
    app.get('/api/thesis/code-reviews', getCodeReviews)
    app.post('/api/thesis/code-reviews', postCodeReview)
    app.get('/api/other', () => ({ ok: true }))
    try {
        const headers = { authorization: 'Bearer code-access-test-token' }
        expect((await app.inject({ method: 'GET', url: '/api/thesis/code-reviews', headers })).statusCode).toBe(200)
        expect((await app.inject({ method: 'GET', url: '/api/thesis/code-reviews?id=source:file.ts', headers })).statusCode).toBe(200)
        expect((await app.inject({ method: 'GET', url: '/api/thesis/code-reviews' })).statusCode).toBe(403)
        expect((await app.inject({ method: 'GET', url: '/api/thesis/code-reviews', headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(401)
        expect((await app.inject({ method: 'POST', url: '/api/thesis/code-reviews', headers, payload: {} })).statusCode).toBe(401)
        expect((await app.inject({ method: 'GET', url: '/api/other', headers })).statusCode).toBe(401)
    } finally { await app.close() }
})
