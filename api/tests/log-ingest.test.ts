import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let stored: unknown[] = [], fail = false, failCommit = false
let hold: Promise<void> | undefined
const operations: string[] = []
const transactionQuery = async () => ({ rows: [] })
mock.module('#db', () => ({ withTransaction: async (work: (query: typeof transactionQuery) => Promise<void>) => {
    operations.push('begin')
    const start = stored.length
    try {
        await hold
        await work(transactionQuery)
        if (failCommit) throw new Error('Commit failed')
        operations.push('commit')
    } catch (error) { stored.length = start; operations.push('rollback'); throw error }
} }))
const previousToken = process.env.LOG_INGEST_TOKEN
mock.module('#utils/auth/internalToken.ts', () => ({ default: (req: any) => req.headers.authorization === 'Bearer existing-internal-token' }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async (event: unknown, query: unknown) => { expect(query).toBe(transactionQuery); if (fail) throw new Error('Database unavailable'); stored.push(event) } }))
const { default: ingestLog, hasLogIngestToken, logIngestCapacity } = await import('../src/handlers/logs/ingest.ts')
const app = Fastify()
app.post('/logs/ingest', ingestLog)
beforeEach(() => { stored = []; fail = false; failCommit = false; operations.length = 0; process.env.LOG_INGEST_TOKEN = 'dedicated-log-token' })
afterAll(async () => { await app.close(); if (previousToken === undefined) delete process.env.LOG_INGEST_TOKEN; else process.env.LOG_INGEST_TOKEN = previousToken })
const payload = { service: 'audit', host: 'inspur', message: 'whoami', metadata: { process: { executable: '/usr/bin/whoami' } } }
const send = (authorization: string, body: unknown = payload) => app.inject({ method: 'POST', url: '/logs/ingest', headers: { authorization }, payload: body as any })
test('scoped ingestion token and existing internal clients are accepted', async () => {
    expect((await send('Bearer dedicated-log-token')).statusCode).toBe(201)
    expect((await send('Bearer existing-internal-token')).statusCode).toBe(201)
    expect(stored).toHaveLength(2)
    expect(hasLogIngestToken({ headers: { authorization: 'Bearer dedicated%2Dlog%2Dtoken' } })).toBe(true)
    for (const token of ['', 'dedicated-log-token', 'Bearer wrong', 'Bearer dedicated-log-tokem']) expect((await send(token)).statusCode).toBe(401)
    delete process.env.LOG_INGEST_TOKEN
    expect((await send('Bearer dedicated-log-token')).statusCode).toBe(401)
})
test('validates the full batch before storage and only acknowledges durable writes', async () => {
    expect((await send('Bearer dedicated-log-token', { events: [payload, { ...payload, metadata: 'bad' }] })).statusCode).toBe(400)
    expect(stored).toHaveLength(0)
    expect(operations).toEqual([])
    fail = true
    expect((await send('Bearer dedicated-log-token')).statusCode).toBe(500)
    expect(stored).toHaveLength(0)
})


test('a full collector batch uses one durable transaction', async () => {
    const response = await send('Bearer dedicated-log-token', { events: Array.from({ length: 200 }, (_, index) => ({ ...payload, sourceEventId: `fixture-${index}` })) })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({ ok: true, accepted: 200 })
    expect(stored).toHaveLength(200)
    expect(operations).toEqual(['begin', 'commit'])
})

test('commit failure rolls back the batch and never acknowledges it', async () => {
    failCommit = true
    expect((await send('Bearer dedicated-log-token', { events: [payload, payload] })).statusCode).toBe(500)
    expect(stored).toHaveLength(0)
    expect(operations).toEqual(['begin', 'rollback'])
})

test('busy ingestion leaves pool capacity available and retries only unacknowledged batches', async () => {
    let release!: () => void
    hold = new Promise<void>(resolve => { release = resolve })
    const active = Array.from({ length: logIngestCapacity }, () => Promise.resolve(send('Bearer dedicated-log-token')))
    try {
        for (let attempt = 0; operations.length < logIngestCapacity && attempt < 100; attempt++) await Bun.sleep(1)
        expect(operations).toHaveLength(logIngestCapacity)
        const busy = await send('Bearer dedicated-log-token')
        expect(busy.statusCode).toBe(503)
        expect(busy.headers['retry-after']).toBe('1')
        expect(busy.json().code).toBe('LOG_INGEST_BUSY')
        expect(operations).toHaveLength(logIngestCapacity)
        expect(stored).toHaveLength(0)
        expect((await send('Bearer wrong')).statusCode).toBe(401)
        release(); hold = undefined
        expect((await Promise.all(active)).every(response => response.statusCode === 201)).toBe(true)
        expect((await send('Bearer dedicated-log-token')).statusCode).toBe(201)
        expect(stored).toHaveLength(logIngestCapacity + 1)
        failCommit = true
        for (let i = 0; i <= logIngestCapacity; i++) expect((await send('Bearer dedicated-log-token')).statusCode).toBe(500)
        failCommit = false
        expect((await send('Bearer dedicated-log-token')).statusCode).toBe(201)
    } finally { release(); hold = undefined; await Promise.allSettled(active) }
})
