#!/usr/bin/env bun
/** Read database metadata, never application records; publish one shared snapshot. */
import { execFileSync } from 'node:child_process'
import { statfsSync, statSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'

export function command(args, timeout = 15_000) {
    return execFileSync(args[0], args.slice(1), { timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

export function engineFor(item) {
    const image = item.Config.Image.split('/').at(-1).split(':')[0]
    const executable = item.Path?.split('/').at(-1) || ''
    const args = item.Args || []
    if (image === 'postgres' || executable === 'postgres' || (args.length > 0 && args[0] === 'postgres')) return 'PostgreSQL'
    if (image === 'mongo') return 'MongoDB'
    if (image === 'redis') return 'Redis'
    return null
}

export function collectDatabase(item, runCommand = command) {
    const name = item.Name.replace(/^\/+/, '')
    const engine = engineFor(item)
    const result = { id: name, engine, status: 'unavailable', databases: [] }
    if (!item.State.Running) return result
    try {
        if (engine === 'PostgreSQL') {
            // Container-local settings stay in the container. No credentials enter output.
            const sql = `SELECT json_build_object('name', d.datname, 'sizeBytes', pg_database_size(d.oid),
                'connections', (SELECT count(*) FROM pg_stat_activity a WHERE a.datid=d.oid),
                'replica', pg_is_in_recovery()) FROM pg_database d
                WHERE d.datallowconn AND NOT d.datistemplate ORDER BY d.datname`
            const script = `export PGCONNECT_TIMEOUT=3 PGOPTIONS='-c statement_timeout=5000';
                user=\${POSTGRES_USER:-hanasand}; port=\${PGPORT:-5432};
                for socket in /var/run/postgresql/.s.PGSQL.*; do
                  case "$socket" in *.lock) continue;; esac
                  test -S "$socket" && port=\${socket##*.};
                done;
                export PGPASSWORD="\${POSTGRES_PASSWORD:-}";
                exec psql -X -h /var/run/postgresql -p "$port" -U "$user" -d "$2" -At -v ON_ERROR_STOP=1 -c "$1"`
            const output = runCommand(['docker', 'exec', item.Id, 'sh', '-c', script, 'metrics', sql, 'postgres'])
            result.databases = output.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
            for (const database of result.databases) {
                try {
                    const tablesSql = `SELECT json_build_object('schema', n.nspname, 'name', c.relname,
                        'sizeBytes', pg_total_relation_size(c.oid), 'estimatedRows', c.reltuples::bigint,
                        'writes', COALESCE(s.n_tup_ins,0)+COALESCE(s.n_tup_upd,0)+COALESCE(s.n_tup_del,0),
                        'columns', COALESCE((SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
                            WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::json))
                        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                        LEFT JOIN pg_stat_all_tables s ON s.relid=c.oid
                        WHERE c.relkind IN ('r','p','m') AND n.nspname NOT IN ('pg_catalog','information_schema')
                            AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname,c.relname`
                    const rows = runCommand(['docker', 'exec', item.Id, 'sh', '-c', script, 'metrics', tablesSql, database.name])
                    database.tables = rows.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
                    database.tableCount = database.tables.length
                } catch {
                    database.tableCount = null
                }
            }
        } else if (engine === 'MongoDB') {
            const script = `JSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d=>{
                const database=db.getSiblingDB(d.name);
                const tables=database.getCollectionInfos({type:'collection'}).map(c=>{
                    const stats=database.getCollection(c.name).aggregate([{$collStats:{storageStats:{},latencyStats:{}}}]).toArray()[0];
                    const s=stats.storageStats;
                    return {schema:'',name:c.name,sizeBytes:Number(s.totalSize||s.storageSize||0),
                        estimatedRows:Number(s.count||0),columns:[],writes:Number(stats.latencyStats.writes.ops)};
                });
                return {name:d.name,sizeBytes:Number(d.sizeOnDisk),connections:null,tableCount:tables.length,tables};
            }))`
            result.databases = JSON.parse(runCommand(['docker', 'exec', item.Id, 'mongosh', '--quiet', '--eval', script], 45_000))
        } else {
            const memoryOutput = runCommand(['docker', 'exec', item.Id, 'redis-cli', '--raw', 'INFO', 'memory'])
            const memory = Object.fromEntries(memoryOutput.split(/\r?\n/).filter(line => line.includes(':')).map(line => line.split(':', 2)))
            const keyspace = runCommand(['docker', 'exec', item.Id, 'redis-cli', '--raw', 'INFO', 'keyspace'])
            result.databases = []
            for (const line of keyspace.split(/\r?\n/)) {
                if (!line.startsWith('db') || !line.includes(':')) continue
                const [database, counts] = line.split(':', 2)
                const fields = Object.fromEntries(counts.split(',').map(part => part.split('=', 2)))
                result.databases.push({ name: database, sizeBytes: null, connections: null, memory: true, tableCount: Number(fields.keys) })
            }
            if (!result.databases.length) result.databases = [{ name: 'db0', sizeBytes: 0, connections: null, memory: true, tableCount: 0 }]
            result.memoryBytes = Number(memory.used_memory)
        }
        if (!result.databases.length) throw new Error('Empty inventory')
        result.status = item.State.Health?.Status === 'unhealthy' ? 'unhealthy' : 'healthy'
    } catch {
        // Do not serialize command output: authentication errors can include secrets.
        result.status = 'unavailable'
    }
    return result
}

export function growth(history, now, available, device) {
    const samples = history.filter(sample => sample.device === device && 0 <= now - sample.at && now - sample.at <= 86400)
    samples.push({ at: now, available, device })
    const elapsed = now - samples[0].at
    const daily = elapsed >= 3600 ? (samples[0].available - available) * 86400 / elapsed : null
    const days = daily !== null && daily > 0 ? available / daily : null
    return { samples, daily, days, elapsed }
}

async function readJson(path, fallback) {
    try { return JSON.parse(await readFile(path, 'utf8')) }
    catch { return fallback }
}

async function mapLimit(values, limit, work) {
    const output = new Array(values.length)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
        while (next < values.length) {
            const index = next++
            output[index] = await work(values[index])
        }
    }))
    return output
}

export async function atomicWrite(path, value) {
    const temporary = path.replace(/\.[^.]+$/, '.tmp')
    await writeFile(temporary, JSON.stringify(value), { mode: 0o644 })
    await rename(temporary, path)
}

export async function collect(destination, runCommand = command, now = Date.now() / 1000, disk = () => {
    const stats = statfsSync('/')
    const root = statSync('/')
    return { total: stats.blocks * stats.bsize, available: stats.bavail * stats.bsize, device: root.dev }
}) {
    const ids = runCommand(['docker', 'ps', '-aq']).split(/\r?\n/).filter(Boolean)
    const items = ids.length ? JSON.parse(runCommand(['docker', 'inspect', ...ids])) : []
    const containers = items.filter(item => engineFor(item))
    const databases = await mapLimit(containers, 4, item => collectDatabase(item, runCommand))
    const writesPath = destination.replace(/[^/]+$/, 'database-table-writes.json')
    const previous = await readJson(writesPath, {})
    const writes = {}
    const sampledAt = new Date().toISOString()
    for (const instance of databases) {
        for (const database of instance.databases) {
            for (const table of database.tables || []) {
                const key = JSON.stringify([instance.id, database.name, table.schema, table.name])
                const old = previous[key] || {}
                const count = table.writes
                delete table.writes
                if (count == null) continue
                // PostgreSQL has no historical last-DML timestamp. Record observed
                // counter increases, never invent a timestamp for existing rows.
                const lastWrite = count > (old.count ?? count) ? sampledAt : old.at
                writes[key] = { count, at: lastWrite }
                table.lastWriteObservedAt = lastWrite
            }
        }
    }
    await atomicWrite(writesPath, writes)
    const stats = disk()
    const historyPath = destination.replace(/[^/]+$/, 'database-storage-history.json')
    const history = await readJson(historyPath, [])
    const diskHistory = growth(history, now, stats.available, stats.device)
    await atomicWrite(historyPath, diskHistory.samples)
    return {
        sampledAt: new Date().toISOString(),
        host: os.hostname(),
        instances: databases.sort((left, right) => left.id.localeCompare(right.id)),
        disk: { totalBytes: stats.total, availableBytes: stats.available, dailyGrowthBytes: diskHistory.daily,
            daysUntilFull: diskHistory.days, sampleSeconds: diskHistory.elapsed },
    }
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/database-metrics.ts') || process.argv[1]?.endsWith('/database-metrics.ts')) {
    const destination = process.argv[2] || '/var/lib/hanasand/metrics/databases.json'
    await atomicWrite(destination, await collect(destination))
}
