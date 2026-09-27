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
const queryConcurrency = Number(process.env.PGBOUNCER_TEST_QUERY_CONCURRENCY || 16)
assert.ok(Number.isInteger(queryConcurrency) && queryConcurrency > 0 && queryConcurrency <= clientCount,
    'Query concurrency must be between 1 and the client count.')
const pool = new pg.Pool({
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
})
const clients: pg.PoolClient[] = []
const connectedAt = performance.now()

try {
    const connected = await Promise.allSettled(Array.from({ length: clientCount }, async () => {
        const client = await pool.connect()
        clients.push(client)
        return client
    }))
    const failedConnection = connected.find(result => result.status === 'rejected')
    if (failedConnection?.status === 'rejected') throw failedConnection.reason
    const connectionMs = performance.now() - connectedAt

    const queryAt = performance.now()
    const results: Array<pg.QueryResult<{ client_id: number }>> = new Array(clientCount)
    await Promise.all(Array.from({ length: queryConcurrency }, async (_, worker) => {
        for (let index = worker; index < clientCount; index += queryConcurrency) {
            results[index] = await clients[index].query({
                name: 'pgbouncer-capacity-probe',
                text: 'SELECT $1::integer AS client_id',
                values: [index],
            })
        }
    }))
    const queryMs = performance.now() - queryAt
    assert.equal(results.length, clientCount)
    assert.ok(results.every((result, index) => result.rows[0]?.client_id === index))

    console.log(JSON.stringify({
        ok: true,
        clients: clientCount,
        queryConcurrency,
        connectedPoolClients: pool.totalCount,
        connectionMs: Math.round(connectionMs),
        namedPreparedQueryMs: Math.round(queryMs),
    }))
} finally {
    for (const client of clients) client.release()
    await pool.end()
}
