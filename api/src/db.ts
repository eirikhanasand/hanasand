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
