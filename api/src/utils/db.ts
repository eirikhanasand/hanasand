import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import config from '#constants'

type SQLParamType = (string | number | null | boolean | string[] | Date)[]
type PgError = Error & {
    code?: string
}

const {
    DB,
    DB_USER,
    DB_HOST,
    DB_POOL_HOST,
    DB_POOL_PORT,
    DB_PASSWORD,
    DB_PORT,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS
} = config
const { Pool } = pg
const schemaWork = new AsyncLocalStorage<boolean>()

// A queued schema lock also blocks later reads, including authentication.
// Keep this policy scoped to migrations; ordinary queries retain their settings.
export function withSchemaLockTimeout<T>(work: () => Promise<T>): Promise<T> {
    return schemaWork.run(true, work)
}

const eventWork = new AsyncLocalStorage<boolean>()
const maxConnections = Number(DB_MAX_CONN) || (DB_POOL_HOST ? 1000 : 20)
// Bound the number of requests waiting inside node-postgres. Without this,
// bursts can turn into an unbounded in-process queue while the database is slow.
const maxWaitingConnections = Math.max(8, Math.min(64, maxConnections * 2))
// Schema setup and session-scoped advisory locks bypass transaction pooling.
// Reserve those clients inside the configured total instead of adding a second budget.
const directConnections = DB_POOL_HOST ? Math.min(8, maxConnections) : 0
// Reserve worker capacity without increasing its total connection budget.
// Event holds cursor and batch locks while committing evidence on another client.
const eventConnections = process.env.API_HTTP_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1'
    && maxConnections >= 12 ? 8 : 0
const httpOnlyApi = process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'
const configuredIdleTimeout = Number(DB_IDLE_TIMEOUT_MS) || (
    process.env.AUTH_SERVICE_ONLY === '1' ? 5000 : 120_000
)
const poolOptions = {
    user: DB_USER || 'hanasand',
    host: DB_POOL_HOST || DB_HOST,
    database: DB || 'hanasand',
    password: DB_PASSWORD,
    port: Number(DB_POOL_PORT) || Number(DB_PORT) || 5432,
    application_name: process.env.AUTH_SERVICE_ONLY === '1'
        ? 'hanasand-auth'
        : httpOnlyApi ? 'hanasand-api-http' : 'hanasand-api',
    max: maxConnections - eventConnections - directConnections,
    // Do not pin API sessions behind HAProxy's reloadable DB listener. The
    // short idle window leaves room for sessions released just after a reload.
    min: 0,
    idleTimeoutMillis: httpOnlyApi
        ? Math.min(Math.max(configuredIdleTimeout, 1), 15_000)
        : configuredIdleTimeout,
    // Rotate sessions even under steady traffic so old HAProxy workers can drain.
    maxLifetimeSeconds: httpOnlyApi ? 45 : undefined,
    connectionTimeoutMillis: Number(DB_TIMEOUT_MS) || 3000,
    statement_timeout: (process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1') ? 5000 : undefined,
    keepAlive: true
}
const pool = new Pool(poolOptions)
const eventPool = eventConnections ? new Pool({ ...poolOptions, max: eventConnections }) : pool
// Schema startup uses session-scoped SET/RESET and CREATE INDEX CONCURRENTLY.
// Keep that small, infrequent path on PostgreSQL directly when traffic uses PgBouncer.
const directPool = DB_POOL_HOST ? new Pool({ ...poolOptions, host: DB_HOST, port: Number(DB_PORT) || 5432, max: directConnections }) : pool

export function withEventDatabase<T>(work: () => Promise<T>): Promise<T> {
    return eventWork.run(true, work)
}

function activePool() {
    if (schemaWork.getStore()) return directPool
    return eventWork.getStore() ? eventPool : pool
}

function connectDatabase(connectionPool: pg.Pool) {
    if (connectionPool.waitingCount >= maxWaitingConnections) {
        throw Object.assign(new Error('Database is temporarily busy. Try again shortly.'), { statusCode: 503, code: 'DB_QUEUE_FULL' })
    }
    return connectionPool.connect()
}

// Checked-out clients can emit transport errors between queries, outside the pool's idle handler.
for (const connectionPool of new Set([pool, eventPool, directPool])) {
    connectionPool.on('connect', client => client.on('error', error => console.error('Database connection failed:', error.message)))
    connectionPool.on('error', error => console.error('Idle database connection failed:', error.message))
}

export async function closeDatabase() {
    await Promise.all([...new Set([pool, eventPool, directPool])].map(connectionPool => connectionPool.end()))
}

export default async function run(query: string, params?: SQLParamType, name?: string) {
    // Authentication must fail promptly; replaying an ambiguous write can duplicate it.
    if ((process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1')) return queryOnce(query, params, name)
    while (true) {
        try {
            return await queryOnce(query, params, name)
        } catch (error) {
            if (!isTransientDatabaseError(error)) {
                throw error
            }

            console.log(`Pool currently unavailable, retrying in ${config.CACHE_TTL_HOT / 1000}s...`)
            console.log(error)
            await sleep(config.CACHE_TTL_HOT)
        }
    }
}

;(run as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner = true

export async function queryOnce(query: string, params?: SQLParamType, name?: string) {
    const client = await connectDatabase(activePool()).catch(error => {
        // No query has been submitted yet: one retry can survive a brief pool
        // shortage without replaying writes or extending authentication retries.
        if (process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'
            && (isTransientDatabaseError(error) || error?.message === 'timeout exceeded when trying to connect')) {
            return connectDatabase(activePool())
        }
        throw error
    })
    let failure: Error | undefined
    let expired = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const onlineIndex = /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(query)
    try {
        if (schemaWork.getStore()) {
            await client.query('SET lock_timeout = \'1s\'; SET statement_timeout = \'5s\'')
            // Cancelling an online index build leaves an invalid index behind.
            // It allows normal reads/writes, so retain only its lock-wait limit.
            if (onlineIndex) {
                await client.query('SET statement_timeout = 0')
            }
        }
        const pending = name
            ? client.query({ name, text: query, values: params ?? [] })
            : client.query(query, params ?? [])
        if (!schemaWork.getStore() || onlineIndex) return await pending
        // A simple-protocol SQL batch is one implicit transaction. PostgreSQL's
        // statement_timeout applies separately to each statement in that batch.
        return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                expired = true
                const error = Object.assign(new Error('Schema SQL batch exceeded 8 seconds'), { code: '57014' })
                client.release(error)
                reject(error)
            }, 8000)
        })])
    } catch (error) {
        failure = error as Error
        throw error
    } finally {
        clearTimeout(timer)
        if (schemaWork.getStore() && !failure) {
            await client.query('RESET lock_timeout; RESET statement_timeout').catch(error => { failure = error })
        }
        if (!expired) client.release(failure)
    }
}

export async function withDatabaseAdvisoryLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    // A session advisory lock must keep using the same PostgreSQL backend until
    // it is unlocked. Transaction pooling can assign a different backend per query.
    const client = await connectDatabase(DB_POOL_HOST ? directPool : activePool())
    try {
        await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key])
        return await work()
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => {})
        client.release()
    }
}

export async function withTransaction<T>(work: (query: typeof queryOnce) => Promise<T>) {
    const client = await connectDatabase(activePool())
    const schema = schemaWork.getStore()
    let expired = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutError = Object.assign(new Error('Schema transaction exceeded 8 seconds'), { code: '57014' })
    const query = ((sql: string, params?: SQLParamType, name?: string) => {
        if (expired) return Promise.reject(timeoutError)
        return name
            ? client.query({ name, text: sql, values: params ?? [] })
            : client.query(sql, params ?? [])
    }) as typeof queryOnce
    const execute = async () => {
        await client.query('BEGIN')
        if (schema) await client.query('SET LOCAL lock_timeout = \'1s\'; SET LOCAL statement_timeout = \'5s\'; SET LOCAL idle_in_transaction_session_timeout = \'5s\'')
        const result = await work(query)
        if (expired) throw timeoutError
        await client.query('COMMIT')
        return result
    }
    try {
        if (!schema) return await execute()
        return await Promise.race([execute(), new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                expired = true
                // Closing the connection rolls back the whole transaction and
                // releases its locks, even if application code is awaiting I/O.
                client.release(timeoutError)
                reject(timeoutError)
            }, 8000)
        })])
    } catch (error) {
        if (!expired) await client.query('ROLLBACK')
        throw error
    } finally {
        clearTimeout(timer)
        if (!expired) client.release()
    }
}

export function isTransientDatabaseError(error: unknown) {
    const err = error as PgError
    const message = err?.message?.toLowerCase() || ''
    const retryableCodes = new Set([
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
        '08000',
        '08001',
        '08003',
        '08006',
        '53300',
        '57P03',
    ])

    return Boolean(err?.code && retryableCodes.has(err.code))
        || message.includes('connection terminated')
        || message.includes('connection timeout')
        || message.includes('timeout expired')
}

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}
