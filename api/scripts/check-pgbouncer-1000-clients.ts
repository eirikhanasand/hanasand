import assert from 'node:assert/strict'
import pg from 'pg'

const connectionString = process.env.PGBOUNCER_TEST_URL
const target = connectionString ? new URL(connectionString) : undefined
const host = target?.hostname || process.env.PGBOUNCER_TEST_HOST || '127.0.0.1'
const port = Number(target?.port || 18505)
assert.equal(port, 18505, 'Refusing to run unless the target is the PgBouncer listener on port 18505.')
assert.ok(['127.0.0.1', 'localhost', 'host.docker.internal', 'pgbouncer'].includes(host), 'Use a local PgBouncer listener.')

const clientCount = Number(process.env.PGBOUNCER_TEST_CLIENTS || 1000)
assert.ok(Number.isInteger(clientCount) && clientCount > 0 && clientCount <= 1000, 'Client count must be 1–1000.')
const queryConcurrency = Number(process.env.PGBOUNCER_TEST_QUERY_CONCURRENCY || clientCount)
assert.ok(Number.isInteger(queryConcurrency) && queryConcurrency > 0 && queryConcurrency <= clientCount,
    'Query concurrency must be between 1 and the client count.')
const backgroundLoadConcurrency = Number(process.env.PGBOUNCER_TEST_BACKGROUND_CONCURRENCY || 16)
assert.ok(Number.isInteger(backgroundLoadConcurrency) && backgroundLoadConcurrency >= 0 && backgroundLoadConcurrency <= 128,
    'Background query concurrency must be between 0 and 128.')
const poolOptions = {
    ...(connectionString ? { connectionString } : {
        host,
        port,
        user: process.env.DB_USER || 'hanasand',
        password: process.env.DB_PASSWORD,
        database: process.env.DB || 'hanasand',
    }),
    max: clientCount,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
}
const pool = new pg.Pool(poolOptions)
const loadPool = backgroundLoadConcurrency ? new pg.Pool({ ...poolOptions, max: backgroundLoadConcurrency }) : null
const clients: pg.PoolClient[] = []
const connectionLatencies = new Array<number>(clientCount)
const reuseLatencies = new Array<number>(clientCount)
const queryLatencies = new Array<number>(clientCount)
let runBackgroundLoad = true
let backgroundQueries = 0
let backgroundErrors = 0

function percentiles(values: number[]) {
    const sorted = [...values].sort((left, right) => left - right)
    const at = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1]
    const rounded = (value: number) => Math.round(value * 100) / 100
    return { min: rounded(sorted[0]), p50: rounded(at(0.50)), p90: rounded(at(0.90)), p95: rounded(at(0.95)),
        p99: rounded(at(0.99)), max: rounded(sorted.at(-1)!) }
}

const backgroundWorkers = Array.from({ length: backgroundLoadConcurrency }, async () => {
    while (runBackgroundLoad) {
        try {
            await loadPool!.query('SELECT 1')
            backgroundQueries++
        } catch {
            backgroundErrors++
        }
    }
})

try {
    const connectionStartedAt = performance.now()
    const connected = await Promise.allSettled(Array.from({ length: clientCount }, async (_, index) => {
        const startedAt = performance.now()
        const client = await pool.connect()
        connectionLatencies[index] = performance.now() - startedAt
        clients.push(client)
        return client
    }))
    const failedConnection = connected.find(result => result.status === 'rejected')
    if (failedConnection?.status === 'rejected') throw failedConnection.reason
    const connectionWaveMs = performance.now() - connectionStartedAt

    for (const client of clients) client.release()
    clients.length = 0
    const reuseStartedAt = performance.now()
    const reused = await Promise.all(Array.from({ length: clientCount }, async (_, index) => {
        const startedAt = performance.now()
        const client = await pool.connect()
        reuseLatencies[index] = performance.now() - startedAt
        clients.push(client)
        return client
    }))
    const reuseWaveMs = performance.now() - reuseStartedAt

    const queryStartedAt = performance.now()
    await Promise.all(Array.from({ length: queryConcurrency }, async (_, worker) => {
        for (let index = worker; index < clientCount; index += queryConcurrency) {
            const startedAt = performance.now()
            const result: pg.QueryResult<{ client_id: number }> = await reused[index].query({
                name: 'pgbouncer-capacity-probe',
                text: 'SELECT $1::integer AS client_id',
                values: [index],
            })
            queryLatencies[index] = performance.now() - startedAt
            assert.equal(result.rows[0]?.client_id, index)
        }
    }))
    const queryWaveMs = performance.now() - queryStartedAt
    runBackgroundLoad = false
    await Promise.all(backgroundWorkers)

    console.log(JSON.stringify({
        ok: true,
        clients: clientCount,
        queryConcurrency,
        backgroundLoadConcurrency,
        connectedPoolClients: pool.totalCount,
        connectionWaveMs: Math.round(connectionWaveMs),
        freshConnectionMs: percentiles(connectionLatencies),
        reuseWaveMs: Math.round(reuseWaveMs),
        reusedLeaseMs: percentiles(reuseLatencies),
        queryWaveMs: Math.round(queryWaveMs),
        perClientQueryMs: percentiles(queryLatencies),
        backgroundQueries,
        backgroundErrors,
    }))
} finally {
    runBackgroundLoad = false
    await Promise.all(backgroundWorkers)
    for (const client of clients) client.release()
    await Promise.all([pool.end(), loadPool?.end()])
}
