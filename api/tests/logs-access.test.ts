import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let authorized = true
let administrator = true
let queries = 0
const query = async () => { queries++; return { rows: [] } }
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
mock.module('../src/utils/logs/native.ts', () => ({ listNativeLogs: async () => [], listNativeLogServices: async () => [], isNativeLogSourceAvailable: () => false }))
mock.module('../src/utils/docker/engine.ts', () => ({ listRuntimeLogs: async () => ({ logs: [], containers: [] }), isRuntimeLogSourceAvailable: () => false }))
const { getLogs, getLogServices } = await import('../src/handlers/logs/get.ts')
const { getErrorEvents } = await import('../src/handlers/logs/errors.ts')

test('cached log responses still require a valid administrator on every request', async () => {
    const app = Fastify()
    app.get('/logs', getLogs)
    app.get('/logs/services', getLogServices)
    app.get('/logs/errors', getErrorEvents)
    try {
        for (const url of ['/logs', '/logs/services', '/logs/errors']) {
            authorized = administrator = true
            expect((await app.inject(url)).statusCode).toBe(200)
            const before = queries
            expect((await app.inject(url)).statusCode).toBe(200)
            expect(queries).toBe(before)
            authorized = false
            expect((await app.inject(url)).statusCode).toBe(401)
            authorized = true
            administrator = false
            expect((await app.inject(url)).statusCode).toBe(403)
            expect(queries).toBe(before)
        }
    } finally { await app.close() }
})
