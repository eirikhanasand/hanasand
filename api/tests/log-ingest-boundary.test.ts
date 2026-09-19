import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let stored = 0, rateAllowed = true
const token = process.env.LOG_INGEST_TOKEN
mock.module('#db', () => ({ default: async () => ({ rows: [] }), withTransaction: async (work: any) => work(async () => ({rows:[]})), isTransientDatabaseError: () => false }))
mock.module('#utils/auth/internalToken.ts', () => ({ default: (req: any) => req.headers.authorization === 'Bearer existing-internal' }))
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => null }))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => null, matchApiKeyScope: () => null, organizationPublicApiScopes: () => [] }))
mock.module('#utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async () => { stored++ } }))
mock.module('#utils/rateLimit/config.ts', () => ({ registerRateLimitRoute: () => {}, resetSharedRateLimitBuckets: () => {},
    getRateLimitSettings: async () => ({enabled:true, defaults: {internal:{windowMs:60000,maxRequests:6000},anonymous:{windowMs:60000,maxRequests:90}},overrides:[]}),
    consumeSharedRateLimitBucket: async () => ({allowed:rateAllowed,remaining:5,resetAt:Date.now()+60000,retryAfterMs:60000}) }))
const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const { default: ingestLog } = await import('../src/handlers/logs/ingest.ts')
const app = Fastify()
await app.register(rateLimit)
app.post('/api/logs/ingest', ingestLog)
app.get('/api/logs', async () => ({ private: true }))
await app.ready()
beforeEach(() => {stored=0;rateAllowed=true;process.env.LOG_INGEST_TOKEN='dedicated-ingest'})
afterAll(async () => {await app.close();if(token===undefined)delete process.env.LOG_INGEST_TOKEN;else process.env.LOG_INGEST_TOKEN=token})
const send = (value: string) => app.inject({method:'POST',url:'/api/logs/ingest',headers:{authorization:'Bearer '+value},payload:{service:'audit',message:'whoami'}})
test('both authorized collector credentials reach ingestion through the real rate-limit hook', async () => {
    for(const value of ['dedicated-ingest','existing-internal']) {
        const response=await send(value)
        expect(response.statusCode).toBe(201)
        expect(response.headers['x-rate-limit-scope']).toBe('internal')
    }
    expect(stored).toBe(2)
})
test('dedicated collector credential cannot read logs or authenticate another route', async () => {
    expect((await app.inject({method:'GET',url:'/api/logs',headers:{authorization:'Bearer dedicated-ingest'}})).statusCode).toBe(401)
    expect((await send('wrong')).statusCode).toBe(401)
    expect(stored).toBe(0)
})
test('collector ingestion still obeys configured rate limits', async () => {
    rateAllowed=false
    expect((await send('dedicated-ingest')).statusCode).toBe(429)
    expect(stored).toBe(0)
})
