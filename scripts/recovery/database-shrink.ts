#!/usr/bin/env bun
/** Bounded physical tail reclamation; never deletes live rows or rewrites tables. */
import { execFileSync, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, fsyncSync } from 'node:fs'
import path from 'node:path'

export const THRESHOLD = 20_000_000_000
export const MIN_FREE = 5 * 1024 ** 3
export const COOLDOWN = 3600
export const TABLE_COOLDOWN = 6 * 3600
export const TABLES = ['traffic_events', 'log_dimensions', 'service_logs', 'events'] as const
export const STATE = '/home/hanasand/hanasand/ops/runtime/database-shrink/status.json'
export const DEPLOY_LOCK = '/tmp/hanasand-frontend-deploy.lock'
export const BUSY_SQL = `EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
  AND (application_name = 'pg_dump' AND xact_start IS NOT NULL
    OR state = 'active' AND query ~* '^\\s*(VACUUM|REINDEX|CLUSTER)\\s'))
  OR EXISTS (SELECT 1 FROM pg_stat_progress_create_index)
  OR EXISTS (SELECT 1 FROM pg_stat_progress_vacuum)
  OR EXISTS (SELECT 1 FROM pg_stat_progress_cluster)
  OR EXISTS (SELECT 1 FROM rule_reprocess_jobs WHERE status IN ('queued','running'))`
export const INVENTORY_SQL = `SELECT json_build_object('database_bytes',pg_database_size(current_database()),
  'replica',pg_is_in_recovery(), 'busy', (${BUSY_SQL}),
  'tables',(SELECT json_agg(json_build_object('name',c.relname,'bytes',pg_total_relation_size(c.oid)))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname IN ('traffic_events','log_dimensions','service_logs','events')));`

export function sql(script: string, timeout = 40) {
    const result = spawnSync('docker', ['exec', '-i', '-e', 'PGOPTIONS=-c application_name=hanasand_database_shrink -c statement_timeout=30000 -c lock_timeout=500 -c vacuum_cost_delay=10 -c vacuum_cost_limit=100',
        'hanasand_database', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'hanasand', '-d', 'hanasand'], { input: script, encoding: 'utf8', timeout })
    if (result.status !== 0) throw new Error(result.stderr || `psql failed (${result.status})`)
    return result.stdout.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line))
}
export function freeBytes() {
    const output = execFileSync('docker', ['exec', 'hanasand_database', 'df', '-B1', '--output=avail', '/var/lib/postgresql/data'], { encoding: 'utf8', timeout: 10000 })
    return Number(output.trim().split(/\r?\n/).at(-1))
}
export function selectTable(inventory: any, state: any, now: number, available: number) {
    if (inventory.replica) return [null, 'replica'] as const
    if (inventory.database_bytes <= THRESHOLD) return [null, 'below_threshold'] as const
    if (available < MIN_FREE) return [null, 'insufficient_headroom'] as const
    if (inventory.busy) return [null, 'maintenance_busy'] as const
    if (now - (state.last_attempt || 0) < COOLDOWN) return [null, 'cooldown'] as const
    const attempts = state.table_attempts || {}
    const candidates = (inventory.tables || []).filter((row: any) => (TABLES as readonly string[]).includes(row.name)
        && now - (attempts[row.name] || 0) >= TABLE_COOLDOWN)
    candidates.sort((a: any, b: any) => (attempts[a.name] || 0) - (attempts[b.name] || 0) || a.bytes - b.bytes)
    return candidates.length ? [candidates[0].name, null] as const : [null, 'table_cooldown'] as const
}
export function vacuumScript(table: string) {
    if (!(TABLES as readonly string[]).includes(table)) throw new Error('Only registered log tables may be maintained')
    const relation = `public.${table}`
    const measure = `json_build_object('database_bytes',pg_database_size(current_database()),'relation_bytes',pg_total_relation_size('${relation}'))`
    return `SELECT pg_try_advisory_lock(hashtextextended('hanasand:database-shrink',0))
      AND pg_try_advisory_lock(hashtextextended('event:service-logs',0))
      AND pg_try_advisory_lock(hashtextextended('event:live-service-logs',0)) AS acquired \\gset
\\if :acquired
SELECT NOT (${BUSY_SQL}) AND NOT pg_is_in_recovery()
 AND pg_database_size(current_database()) > ${THRESHOLD} AS available \\gset
\\if :available
SELECT ${measure};
VACUUM (SKIP_LOCKED, TRUNCATE ON, PARALLEL 0) ${relation};
SELECT ${measure};
\\else
SELECT json_build_object('status','maintenance_busy');
\\endif
\\else
SELECT json_build_object('status','maintenance_busy');
\\endif
`
}
export function save(file: string, value: unknown) {
    mkdirSync(path.dirname(file), { recursive: true })
    const temporary = file.replace(/\.[^.]+$/, '.tmp')
    const fd = openSync(temporary, 'w', 0o600)
    try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temporary, file)
}
export function attempt(file = STATE, checkOnly = false, deps = { sql, freeBytes, now: () => Date.now() / 1000 }) {
    mkdirSync(path.dirname(file), { recursive: true })
    const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    const now = deps.now()
    const inventory = deps.sql(INVENTORY_SQL)[0]
    const available = deps.freeBytes()
    const [table, reason] = selectTable(inventory, state, now, available)
    const result: any = { checked_at: now, database_bytes: inventory.database_bytes, free_bytes: available,
        threshold_bytes: THRESHOLD, status: reason || (checkOnly ? 'eligible' : 'running'), table }
    if (table && !checkOnly) {
        state.last_attempt = now
        state.table_attempts = { ...(state.table_attempts || {}), [table]: now }
        save(file, { ...state, ...result })
        try {
            const measurements = deps.sql(vacuumScript(table), 70)
            if (measurements.length === 2) {
                const [before, after] = measurements
                const decrease = Math.max(0, before.relation_bytes - after.relation_bytes)
                Object.assign(result, { status: decrease ? 'reclaimed' : 'no_physical_reduction', before, after,
                    observed_relation_decrease_bytes: decrease, free_bytes_after: deps.freeBytes() })
            } else result.status = 'maintenance_busy'
        } catch (error) {
            Object.assign(result, { status: 'failed', error: (error as Error).name })
            save(file, { ...state, ...result })
            throw error
        }
    }
    if (!checkOnly) save(file, { ...state, ...result })
    return result
}

if (import.meta.main) {
    if (process.env.HANASAND_SHRINK_LOCKED !== '1') {
        const child = spawnSync('flock', ['-n', path.join(path.dirname(STATE), 'maintenance.lock'), 'flock', '-n', DEPLOY_LOCK,
            process.execPath, import.meta.path, '--locked', ...Bun.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, HANASAND_SHRINK_LOCKED: '1' } })
        process.exit(child.status ?? 1)
    }
    const check = Bun.argv.includes('--check')
    console.log(JSON.stringify(attempt(STATE, check)))
}
