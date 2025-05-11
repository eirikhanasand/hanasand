import pg from 'pg'
import config from './constants.js'

const {
    DB,
    DB_USER,
    DB_HOST,
    DB_PASSWORD,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS
} = config

// Creates and joins the database pool
const { Pool } = pg
const pool = new Pool({
    user: DB_USER || 'hanasanduser',
    host: DB_HOST || 'hanasand_database',
    database: DB || 'hanasanddb',
    password: DB_PASSWORD,
    port: 5432,
    max: Number(DB_MAX_CONN) || 20,
    idleTimeoutMillis: Number(DB_IDLE_TIMEOUT_MS) || 5000,
    connectionTimeoutMillis: Number(DB_TIMEOUT_MS) || 3000
})

/**
 * Runs a database query.
 * 
 * @param query Query to run
 * @param parameters Parameters the query needs to run
 * 
 * @returns Query results or an error.
 */
export default async function run(query: string, params: (string | number | null)[]) {
    const client = await pool.connect()
    try {
        return await client.query(query, params)
    } catch (error) {
        throw error
    } finally {
        client.release()
    }
}

/**
 * Runs an atomic database query using `BEGIN` - `COMMMIT`. It either runs 
 * entirely, or has no effect. If an error returns the query is rolled back.
 * 
 * @param query Query to run
 * @param parameters Parameters the query needs to run
 * 
 * @returns Query results or an error. 
 */
export async function runInTransaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const result = await callback(client)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}
