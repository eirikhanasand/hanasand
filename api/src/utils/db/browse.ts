import { Pool } from 'pg'
import { MongoClient, BSON } from 'mongodb'
import { createClient } from 'redis'
import { getRuntimeContainer } from '#utils/docker/engine.ts'
import { readDatabaseStorage, readRedisWrites } from './storage.ts'

export type BrowseInput = { instance: string, database: string, mode: 'contents' | 'rows' | 'count', schema?: string, table?: string, cursor?: string }
type Cursor = { target: string, values?: unknown[], scan?: string, index?: number, offset?: number }
type RedisConnection = { sendCommand(args: string[]): Promise<unknown>, type(key: string): Promise<string>, getRange(key: string, start: number, end: number): Promise<string | null>, destroy(): void }
type Connection = { pg?: Pool, mongo?: MongoClient, redis?: RedisConnection, used: number }
const connections = new Map<string, Promise<Connection>>()
const expiry = setInterval(() => {
    for (const [key, pending] of connections) void pending.then(async connection => {
        if (Date.now() - connection.used < 60_000) return
        connections.delete(key)
        await connection.pg?.end()
        await connection.mongo?.close()
        connection.redis?.destroy()
    }).catch(() => connections.delete(key))
}, 30_000)
expiry.unref()

function quote(value: string) { return `"${value.replaceAll('"', '""')}"` }
function target(input: BrowseInput) { return JSON.stringify([input.instance, input.database, input.mode, input.schema || '', input.table || '']) }
export function decodeCursor(input: BrowseInput): Cursor {
    if (!input.cursor) return { target: target(input) }
    if (input.cursor.length > 100_000) throw new Error('Invalid cursor')
    const value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as Cursor
    if (value.target !== target(input) || (value.values && !Array.isArray(value.values)) || (value.index !== undefined && (!Number.isSafeInteger(value.index) || value.index < 0)) || (value.offset !== undefined && (!Number.isSafeInteger(value.offset) || value.offset < 0)) || (value.scan !== undefined && !/^\d+$/.test(value.scan))) throw new Error('Invalid cursor')
    return value
}
function encode(value: Cursor) { return Buffer.from(JSON.stringify(value)).toString('base64url') }

async function connect(input: BrowseInput, engine: string) {
    const key = JSON.stringify([input.instance, input.database])
    if (!connections.has(key)) {
        const pending = (async (): Promise<Connection> => {
            const inspect = await getRuntimeContainer(input.instance)
            const env = Object.fromEntries((inspect.Config?.Env || []).map(item => { const at = item.indexOf('='); return [item.slice(0, at), item.slice(at + 1)] }))
            const args = inspect.Config?.Cmd || inspect.Args || []
            const portFlag = args.indexOf('-p')
            const port = Number(env.PGPORT || (portFlag >= 0 ? args[portFlag + 1] : '') || (engine === 'PostgreSQL' ? 5432 : engine === 'MongoDB' ? 27017 : 6379))
            const published = inspect.NetworkSettings?.Ports?.[`${port}/tcp`]?.[0]
            const host = published || inspect.HostConfig?.NetworkMode === 'host' ? '127.0.0.1' : Object.values(inspect.NetworkSettings?.Networks || {}).find(network => network.IPAddress)?.IPAddress
            if (!host) throw new Error('Database address unavailable')
            const actualPort = published ? Number(published.HostPort) : port
            if (engine === 'PostgreSQL') {
                const standby = input.instance === 'hanasand-db-standby'
                const pg = new Pool({ host, port: actualPort, database: input.database, user: env.POSTGRES_USER || (standby ? process.env.DB_USER : undefined) || 'hanasand', password: env.POSTGRES_PASSWORD || (standby ? process.env.DB_PASSWORD : undefined),
                    max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2000,
                    options: '-c default_transaction_read_only=on -c statement_timeout=2000 -c lock_timeout=300', application_name: 'database-preview' })
                pg.on('error', () => { connections.delete(key); void pg.end().catch(() => {}) })
                return { pg, used: Date.now() }
            }
            if (engine === 'MongoDB') {
                const mongo = new MongoClient(`mongodb://${host}:${actualPort}`, { maxPoolSize: 2, maxIdleTimeMS: 30_000, serverSelectionTimeoutMS: 2000,
                    ...(env.MONGO_INITDB_ROOT_USERNAME ? { auth: { username: env.MONGO_INITDB_ROOT_USERNAME, password: env.MONGO_INITDB_ROOT_PASSWORD }, authSource: 'admin' } : {}) })
                await mongo.connect()
                return { mongo, used: Date.now() }
            }
            const passwordAt = args.indexOf('--requirepass')
            const redis = createClient({ socket: { host, port: actualPort, connectTimeout: 2000, reconnectStrategy: false },
                password: env.REDIS_PASSWORD || (passwordAt >= 0 ? args[passwordAt + 1] : undefined), database: Number(input.database.slice(2)) })
            redis.on('error', () => {})
            await redis.connect()
            return { redis, used: Date.now() }
        })()
        connections.set(key, pending)
        void pending.catch(() => connections.delete(key))
    }
    const connection = await connections.get(key)!
    connection.used = Date.now()
    return connection
}

export async function browseDatabase(input: BrowseInput) {
    const started = performance.now()
    const inventory = await readDatabaseStorage()
    const instance = inventory?.instances.find(item => item.id === input.instance)
    const database = instance?.databases.find(item => item.name === input.database)
    if (!instance || !database || inventory?.stale) throw new Error('Database inventory unavailable')
    const cursor = decodeCursor(input)
    if (input.mode === 'contents' && instance.engine !== 'Redis') {
        if (!database.tables) throw new Error('Table inventory unavailable')
        return { items: database.tables, nextCursor: null, elapsedMs: performance.now() - started }
    }
    const connection = await connect(input, instance.engine)
    if (connection.pg) {
        const table = database.tables?.find(item => item.name === input.table && item.schema === input.schema)
        if (!table) throw new Error('Unknown table')
        const name = `${quote(table.schema)}.${quote(table.name)}`
        if (input.mode === 'count') {
            // Retain the connection's short statement timeout for large tables.
            const totalRows = await connection.pg.query(`SELECT count(*) AS count FROM ${name}`)
                .then(result => Number(result.rows[0].count)).catch(() => null)
            return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
        }
        const primary = await connection.pg.query<{ name: string }>('SELECT a.attname AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary ORDER BY array_position(i.indkey,a.attnum)', [name])
        const keys = primary.rows.map(row => row.name)
        if (!keys.length) return browseHeap(connection.pg, input, cursor, name, table.columns, started)
        // A physical cursor avoids growing OFFSET scans for tables without a key.
        // Qualify keys so ORDER BY uses indexed source values, not the text
        // aliases in the preview projection (which would sort the whole table).
        const order = keys.map(key => `preview_row.${quote(key)}`)
        const values = cursor.values || []
        if (values.length && values.length !== order.length) throw new Error('Invalid cursor')
        const columns = table.columns.map(column => `left(${quote(column)}::text,16384) AS ${quote(column)}`).join(',')
        const keyProjection = keys.length ? `json_build_array(${keys.map(key => `${quote(key)}::text`).join(',')})` : 'json_build_array(tableoid::text,ctid::text)'
        const where = values.length ? `WHERE (${order.join(',')}) > (${order.map((_, index) => `$${index + 1}${keys.length ? '' : index === 0 ? '::oid' : '::tid'}`).join(',')})` : ''
        let cursorColumn = '__preview_cursor'
        while (table.columns.includes(cursorColumn)) cursorColumn += '_'
        const result = await connection.pg.query(`SELECT ${columns ? `${columns},` : ''} ${keyProjection} AS ${quote(cursorColumn)} FROM ${name} AS preview_row ${where} ORDER BY ${order.join(',')} LIMIT 6`, values)
        const rows = result.rows.slice(0, 5)
        const nextCursor = result.rows.length > 5 ? encode({ ...cursor, values: rows.at(-1)![cursorColumn] }) : null
        for (const row of rows) delete row[cursorColumn]
        return { rows, fields: table.columns, nextCursor, elapsedMs: performance.now() - started }
    }
    if (connection.mongo) {
        if (!database.tables?.some(item => item.name === input.table)) throw new Error('Unknown collection')
        if (input.mode === 'count') {
            const totalRows = await connection.mongo.db(input.database).collection(input.table!).countDocuments({}, { maxTimeMS: 2000 }).catch(() => null)
            return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
        }
        const after = cursor.values?.[0]
        const documents = await connection.mongo.db(input.database).collection(input.table!).find(after === undefined ? {} : { _id: { $gt: BSON.EJSON.deserialize(after as Record<string, unknown>) } }, { maxTimeMS: 2000 }).sort({ _id: 1 }).limit(6).toArray()
        const rows = documents.slice(0, 5).map(document => BSON.EJSON.serialize(document, { relaxed: true }))
        return { rows, fields: [...new Set(rows.flatMap(row => Object.keys(row)))], nextCursor: documents.length > 5 ? encode({ ...cursor, values: [BSON.EJSON.serialize(documents[4]._id, { relaxed: false })] }) : null, elapsedMs: performance.now() - started }
    }
    const redis = connection.redis!
    if (input.mode === 'contents') {
        const page = await scanFive(redis, ['SCAN'], cursor)
        const writes = await readRedisWrites()
        const items = await Promise.all(page.values.map(async value => {
            const at = writes[JSON.stringify([input.instance, input.database, String(value)])]
            return { name: String(value), schema: '', columns: [], lastWriteObservedAt: at ? new Date(at * 1000).toISOString() : null,
                sizeBytes: Number(await redis.sendCommand(['MEMORY', 'USAGE', String(value)])), type: await redis.type(String(value)) }
        }))
        return { items, nextCursor: page.nextCursor, elapsedMs: performance.now() - started }
    }
    const key = input.table
    if (!key) throw new Error('Key required')
    const type = await redis.type(key)
    if (input.mode === 'count') {
        const command = ({ list: 'LLEN', zset: 'ZCARD', hash: 'HLEN', set: 'SCARD', stream: 'XLEN' } as Record<string, string>)[type]
        const totalRows = command ? Number(await redis.sendCommand([command, key])) : type === 'string' ? 1 : type === 'none' ? 0 : null
        return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
    }
    let rows: Record<string, unknown>[] = [], nextCursor: string | null = null
    const offset = cursor.offset || 0
    if (type === 'string') rows = [{ value: await redis.getRange(key, 0, 16383) }]
    else if (type === 'list' || type === 'zset') {
        const values = await redis.sendCommand([type === 'list' ? 'LRANGE' : 'ZRANGE', key, String(offset), String(offset + 5)]) as string[]
        rows = values.slice(0, 5).map((value, index) => ({ index: offset + index, value }))
        nextCursor = values.length > 5 ? encode({ ...cursor, offset: offset + 5 }) : null
    } else if (type === 'hash' || type === 'set') {
        const page = await scanFive(redis, [type === 'hash' ? 'HSCAN' : 'SSCAN', key], cursor, type === 'hash')
        rows = page.values.map(value => type === 'hash' ? { field: (value as string[])[0], value: (value as string[])[1] } : { value })
        nextCursor = page.nextCursor
    } else if (type === 'stream') {
        const values = await redis.sendCommand(['XRANGE', key, cursor.values?.[0] ? `(${cursor.values[0]}` : '-', '+', 'COUNT', '6']) as Array<[string, string[]]>
        rows = values.slice(0, 5).map(([id, fields]) => ({ id, fields: Object.fromEntries(fields.reduce<Array<[string, string]>>((pairs, value, index) => index % 2 ? pairs : [...pairs, [value, fields[index + 1]]], [])) }))
        nextCursor = values.length > 5 ? encode({ ...cursor, values: [values[4][0]] }) : null
    } else if (type !== 'none') throw new Error('Unsupported Redis value type')
    return { rows, fields: [...new Set(rows.flatMap(row => Object.keys(row)))], nextCursor, elapsedMs: performance.now() - started }
}

// Bound sorting to small physical ranges instead of sorting an entire unindexed
// table for every five-row preview. Include partition leaves in the same cursor.
async function browseHeap(pg: Pool, input: BrowseInput, cursor: Cursor, name: string, columns: string[], started: number) {
    const leaves = await pg.query<{ oid: string, schema: string, name: string, blocks: number }>(`WITH RECURSIVE relations AS (
        SELECT $1::regclass::oid AS oid UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN relations r ON i.inhparent=r.oid
    ) SELECT c.oid::text,n.nspname AS schema,c.relname AS name,ceil(pg_relation_size(c.oid)::numeric/current_setting('block_size')::int)::int AS blocks
    FROM relations r JOIN pg_class c ON c.oid=r.oid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','m') ORDER BY c.oid`, [name])
    const values = cursor.values || []
    if (values.length && (values.length !== 2 || !/^\(\d+,\d+\)$/.test(String(values[1])) || !leaves.rows.some(row => row.oid === String(values[0])))) throw new Error('Invalid cursor')
    let index = values.length ? leaves.rows.findIndex(row => row.oid === String(values[0])) : 0
    let after = values.length ? String(values[1]) : '(0,0)'
    const rows: Record<string, unknown>[] = []
    let alias = '__preview_cursor'
    while (columns.includes(alias)) alias += '_'
    const projection = columns.map(column => `left(${quote(column)}::text,16384) AS ${quote(column)}`)
    for (let attempt = 0; index < leaves.rows.length && attempt < 8; attempt++) {
        const leaf = leaves.rows[index]
        const block = Number(after.slice(1).split(',')[0]), end = Math.min(block + 64, leaf.blocks)
        if (block >= leaf.blocks) { index++; after = '(0,0)'; continue }
        const result = await pg.query(`SELECT ${[...projection, `ctid::text AS ${quote(alias)}`].join(',')} FROM ONLY ${quote(leaf.schema)}.${quote(leaf.name)} WHERE ctid > $1::tid AND ctid < $2::tid ORDER BY ctid LIMIT $3`, [after, `(${end},0)`, 6 - rows.length])
        for (const record of result.rows) {
            if (rows.length === 5) return { rows, fields: columns, nextCursor: encode({ ...cursor, values: [leaf.oid, after] }), elapsedMs: performance.now() - started }
            after = record[alias]; delete record[alias]; rows.push(record)
        }
        after = `(${end},0)`
        if (end >= leaf.blocks) { index++; after = '(0,0)' }
    }
    return { rows, fields: columns, nextCursor: index < leaves.rows.length ? encode({ ...cursor, values: [leaves.rows[index].oid, after] }) : null, elapsedMs: performance.now() - started }
}

async function scanFive(redis: RedisConnection, command: string[], cursor: Cursor, pairs = false) {
    let scan = cursor.scan || '0', index = cursor.index || 0
    const values: unknown[] = []
    for (let attempt = 0; attempt < 20; attempt++) {
        const [next, raw] = await redis.sendCommand([...command, scan, 'COUNT', '5']) as [string, string[]]
        const items = pairs ? raw.filter((_, i) => i % 2 === 0).map((value, i) => [value, raw[i * 2 + 1]]) : raw
        while (index < items.length && values.length < 5) values.push(items[index++])
        if (index < items.length) return { values, nextCursor: encode({ ...cursor, scan, index }) }
        if (next === '0') return { values, nextCursor: null }
        scan = next; index = 0
        if (values.length === 5) break
    }
    return { values, nextCursor: encode({ ...cursor, scan, index }) }
}
