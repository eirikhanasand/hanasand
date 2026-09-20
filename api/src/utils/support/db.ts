import pg from 'pg'
import config from '#constants'
import { queryOnce as primaryQuery, withTransaction as primaryTransaction } from '#db'

export const independentSupport = Boolean(process.env.SUPPORT_DB_HOST)
export function supportConnection() {
    return independentSupport ? {
        host: process.env.SUPPORT_DB_HOST, port: Number(process.env.SUPPORT_DB_PORT || 5432),
        user: process.env.SUPPORT_DB_USER, password: process.env.SUPPORT_DB_PASSWORD,
        database: process.env.SUPPORT_DB_NAME || 'hanasand_support',
    } : { host: config.DB_HOST, port: Number(config.DB_PORT || 5432), user: config.DB_USER || 'hanasand', password: config.DB_PASSWORD, database: config.DB || 'hanasand' }
}
const pool = independentSupport ? new pg.Pool({ ...supportConnection(), max: 8, connectionTimeoutMillis: 3000,
    statement_timeout: 5000, idleTimeoutMillis: 30000, keepAlive: true }) : undefined
pool?.on('error', error => console.error('Support database connection failed:', error.message))
export const queryOnce: typeof primaryQuery = (query, params, name) => pool
    ? pool.query({ text: query, values: params || [], ...(name ? { name } : {}) }) : primaryQuery(query, params, name)
export default queryOnce
export async function withTransaction<T>(work: (query: typeof primaryQuery) => Promise<T>): Promise<T> {
    if (!pool) return primaryTransaction(work)
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const value = await work((query, params) => client.query(query, params))
        await client.query('COMMIT')
        return value
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
    } finally { client.release() }
}
export async function closeSupportDatabase() { await pool?.end() }
