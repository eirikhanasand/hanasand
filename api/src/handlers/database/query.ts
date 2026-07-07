import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { queryOnce } from '#db'

type QueryBody = {
    sql?: string
}

type RowsQuery = {
    schema?: string
    table?: string
    limit?: string
}

export async function getDatabaseHealth(req: FastifyRequest, res: FastifyReply) {
    if (!await requireDatabaseAccess(req, res)) return

    try {
        const result = await queryOnce('SELECT current_database() AS database, now() AS checked_at')
        return res.send({ ok: true, ...result.rows[0] })
    } catch (error) {
        req.log.error(error)
        return res.status(503).send({ ok: false, message: 'Database liveness check failed.' })
    }
}

export async function postDatabaseQuery(req: FastifyRequest<{ Body: QueryBody }>, res: FastifyReply) {
    if (!await requireDatabaseAccess(req, res)) return

    const sql = req.body?.sql?.trim()
    if (!sql) return res.status(400).send({ message: 'SQL statement is required.' })

    try {
        const result = await queryOnce(sql)
        return res.send({ rows: result.rows, rowCount: result.rowCount ?? result.rows.length, fields: result.fields.map(field => field.name) })
    } catch (error) {
        req.log.error(error)
        return res.status(400).send({ message: safeSqlError(error) })
    }
}

export async function getDatabaseRows(req: FastifyRequest<{ Querystring: RowsQuery }>, res: FastifyReply) {
    if (!await requireDatabaseAccess(req, res)) return

    const schema = req.query.schema || 'public'
    const table = req.query.table
    if (!table) return res.status(400).send({ message: 'Table is required.' })

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500)
    try {
        assertIdentifier(schema, 'schema')
        assertIdentifier(table, 'table')
        const result = await queryOnce(`SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} LIMIT $1`, [limit])
        return res.send({ schema, table, rows: result.rows, rowCount: result.rowCount ?? result.rows.length, fields: result.fields.map(field => field.name) })
    } catch (error) {
        req.log.error(error)
        return res.status(400).send({ message: safeSqlError(error) })
    }
}

async function requireDatabaseAccess(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'Missing system_admin role.' })
        return false
    }

    return true
}

function assertIdentifier(value: string, label: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid ${label}.`)
    }
}

function quoteIdentifier(value: string) {
    return `"${value.replace(/"/g, '""')}"`
}

function safeSqlError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return message.replace(/password=[^\s]+/gi, 'password=[redacted]').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://[redacted]')
}
