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

const millWork = new AsyncLocalStorage<boolean>()
const maxConnections = Number(DB_MAX_CONN) || 20
// Reserve worker capacity without increasing its total connection budget.
// Mill holds cursor and batch locks while committing evidence on another client.
const millConnections = process.env.API_HTTP_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1'
    && maxConnections >= 12 ? 8 : 0
const poolOptions = {
    user: DB_USER || 'hanasand',
    host: DB_HOST,
    database: DB || 'hanasand',
    password: DB_PASSWORD,
    port: Number(DB_PORT) || 5432,
    max: maxConnections - millConnections,
    // Keep one API connection between ten-second polls; burst connections still
    // expire normally and authentication/worker pools retain their own policy.
    min: process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1' ? 1 : 0,
    // Retain API and worker burst connections between polls, avoiding repeated
    // database authentications under load. Authentication keeps its own policy.
    idleTimeoutMillis: Number(DB_IDLE_TIMEOUT_MS) || (
        process.env.AUTH_SERVICE_ONLY === '1' ? 5000 : 120_000
    ),
    connectionTimeoutMillis: Number(DB_TIMEOUT_MS) || 3000,
    statement_timeout: (process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1') ? 5000 : undefined,
    keepAlive: true
}
const pool = new Pool(poolOptions)
const millPool = millConnections ? new Pool({ ...poolOptions, max: millConnections }) : pool

export function withMillDatabase<T>(work: () => Promise<T>): Promise<T> {
    return millWork.run(true, work)
}

function activePool() { return millWork.getStore() ? millPool : pool }

// Checked-out clients can emit transport errors between queries, outside the pool's idle handler.
for (const connectionPool of new Set([pool, millPool])) {
    connectionPool.on('connect', client => client.on('error', error => console.error('Database connection failed:', error.message)))
    connectionPool.on('error', error => console.error('Idle database connection failed:', error.message))
}

export async function closeDatabase() {
    await Promise.all([...new Set([pool, millPool])].map(connectionPool => connectionPool.end()))
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

export async function queryOnce(query: string, params?: SQLParamType, name?: string) {
    const client = await activePool().connect().catch(error => {
        // No query has been submitted yet: one retry can survive a brief pool
        // shortage without replaying writes or extending authentication retries.
        if (process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'
            && (isTransientDatabaseError(error) || error?.message === 'timeout exceeded when trying to connect')) {
            return activePool().connect()
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
    const client = await activePool().connect()
    try {
        await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key])
        return await work()
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => {})
        client.release()
    }
}

export async function withTransaction<T>(work: (query: typeof queryOnce) => Promise<T>) {
    const client = await activePool().connect()
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
