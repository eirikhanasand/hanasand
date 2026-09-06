import { test, expect, mock } from 'bun:test'
import Fastify from 'fastify'

mock.module('../src/constants.ts', () => ({ default: { vm_api_token: 'code-access-test-token' } }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async() => null }))
mock.module('../src/utils/db.ts', () => ({ queryOnce: async() => ({ rows: [] }) }))
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
