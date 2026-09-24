// Run only against the three explicitly named local preview-test containers.
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Pool } from 'pg'
import { MongoClient } from 'mongodb'
import { createClient } from 'redis'
import { browseDatabase } from '../src/utils/db/browse.ts'

const port = (name: string, value: number) => Number(JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0].NetworkSettings.Ports[`${value}/tcp`][0].HostPort)
const pg = new Pool({ host: '127.0.0.1', port: port('db-preview-postgres-test', 5432), user: 'preview', password: 'preview-test', database: 'preview' })
const mongo = new MongoClient(`mongodb://127.0.0.1:${port('db-preview-mongo-test', 27017)}`)
const redis = createClient({ socket: { host: '127.0.0.1', port: port('db-preview-redis-test', 6379) } })
const directory = await mkdtemp(join(tmpdir(), 'database-browse-test-'))
process.env.DB_STORAGE_METRICS_FILE = join(directory, 'databases.json')
try {
    await pg.query('CREATE TABLE IF NOT EXISTS "odd table" (id bigint PRIMARY KEY, "__preview_cursor" text); TRUNCATE "odd table"; INSERT INTO "odd table" SELECT 9007199254740992+i, repeat(\'x\',20000) FROM generate_series(1,13) i; CREATE TABLE IF NOT EXISTS heap (n int); TRUNCATE heap; INSERT INTO heap SELECT generate_series(1,13)')
    await mongo.connect(); await mongo.db('preview').collection('items').deleteMany({}); await mongo.db('preview').collection('items').insertMany(Array.from({ length: 13 }, (_, n) => ({ n })))
    await redis.connect(); await redis.flushDb()
    for (let n = 0; n < 13; n++) { await redis.set(`key${n}`, String(n)); await redis.rPush('list', String(n)); await redis.hSet('hash', `field${n}`, String(n)); await redis.sAdd('set', String(n)); await redis.zAdd('zset', { score: n, value: String(n) }); await redis.xAdd('stream', '*', { n: String(n) }) }
    const table = (name: string, columns: string[], schema = '') => ({ name, schema, columns })
    await writeFile(process.env.DB_STORAGE_METRICS_FILE, JSON.stringify({ sampledAt: new Date().toISOString(), disk: { availableBytes: 1 }, instances: [
        { id: 'db-preview-postgres-test', engine: 'PostgreSQL', databases: [{ name: 'preview', tables: [table('odd table', ['id', '__preview_cursor'], 'public'), table('heap', ['n'], 'public')] }] },
        { id: 'db-preview-mongo-test', engine: 'MongoDB', databases: [{ name: 'preview', tables: [table('items', [])] }] },
        { id: 'db-preview-redis-test', engine: 'Redis', databases: [{ name: 'db0' }] },
    ] }))
    const timings: number[] = []
    for (const [instance, database, schema, name] of [
        ['db-preview-postgres-test', 'preview', 'public', 'odd table'], ['db-preview-postgres-test', 'preview', 'public', 'heap'],
        ['db-preview-mongo-test', 'preview', '', 'items'], ...['list', 'hash', 'set', 'zset', 'stream'].map(key => ['db-preview-redis-test', 'db0', '', key]),
    ]) {
        let cursor: string | undefined, rows: unknown[] = [], pages = 0
        do {
            const page = await browseDatabase({ instance, database, schema, table: name, mode: 'rows', cursor })
            assert('rows' in page); assert(page.rows.length <= 5)
            if (pages++) timings.push(page.elapsedMs)
            rows.push(...page.rows); cursor = page.nextCursor || undefined
            assert(pages < 10)
        } while (cursor)
        assert.equal(rows.length, 13, name); assert.equal(new Set(rows.map(row => JSON.stringify(row))).size, 13, name)
        if (name === 'odd table') { assert.equal((rows[0] as any).id, '9007199254740993'); assert.equal((rows[0] as any).__preview_cursor.length, 16384) }
    }
    let cursor: string | undefined, keys: string[] = []
    do { const page = await browseDatabase({ instance: 'db-preview-redis-test', database: 'db0', mode: 'contents', cursor }); assert('items' in page); assert(page.items.length <= 5); keys.push(...page.items.map(item => item.name)); cursor = page.nextCursor || undefined } while (cursor)
    assert.equal(new Set(keys).size, 18)
    await assert.rejects(browseDatabase({ instance: 'unknown', database: 'preview', mode: 'contents' }))
    await assert.rejects(browseDatabase({ instance: 'db-preview-postgres-test', database: 'preview', mode: 'rows', schema: 'public', table: 'odd table; DROP TABLE heap' }))
    console.log(JSON.stringify({ result: 'passed', engines: 3, warmPageMs: timings.map(n => Number(n.toFixed(2))), maxWarmPageMs: Math.max(...timings) }))
} finally { await pg.end(); await mongo.close(); redis.destroy(); await rm(directory, { recursive: true, force: true }) }
process.exit(0)
