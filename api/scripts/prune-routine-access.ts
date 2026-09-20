// Explicit maintenance operation; ordinary ingestion never runs a database scan.
// Run with --apply to delete approved historical GET/200 access records.
import run, { closeDatabase, withTransaction } from '#db'
import { platformAccessRule } from '#utils/mill/analyzeLog.ts'
import { pruneAccessLogs } from '#utils/mill/pruneAccessLogs.ts'
import { storedSourceLog } from '#utils/mill/storedSources.ts'

const apply = process.argv.includes('--apply')
try {
    const rule = await platformAccessRule()
    if (!rule?.enabled || rule.definition?.action !== 'drop') throw new Error('The Analyze rule must be enabled with Count and drop.')
    if (!apply) {
        console.log(JSON.stringify({ apply: false, rule: 'http.routine_access.v1', organization: rule.organization_id, olderThan: rule.created_at,
            message: 'Use --apply for resumable batches. Existing findings, security activity and known request bodies are preserved.' }))
    } else {
        for (const source of ['traffic_events', 'service_logs'] as const) {
            const cursorName = `analyze_prune:${source}`
            await run(`INSERT INTO log_processing_cursors(name,last_id,history_end_id) SELECT $1,0,COALESCE(MAX(id),0) FROM ${source} ON CONFLICT DO NOTHING`, [cursorName])
            let finished = false, total = 0
            while (!finished) {
                await withTransaction(async query => {
                    await query('SET LOCAL lock_timeout = \'2s\'')
                    await query('SET LOCAL statement_timeout = \'20s\'')
                    const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'mill:service-logs\',0)) AS locked')
                    if (!lock.rows[0].locked) return
                    const active = await platformAccessRule(query)
                    if (!active?.enabled || active.definition?.action !== 'drop') throw new Error('Analyze rule was disabled or changed to Keep; cleanup stopped.')
                    const cursor = (await query('SELECT last_id,history_end_id FROM log_processing_cursors WHERE name=$1 FOR UPDATE', [cursorName])).rows[0]
                    const batch = await query(`SELECT * FROM ${source} WHERE id>$1 AND id<=$2 ORDER BY id LIMIT 1000`, [cursor.last_id, cursor.history_end_id])
                    if (!batch.rows.length) { finished = true; return }
                    const logs = source === 'traffic_events' ? batch.rows.map(row => storedSourceLog(source, row)) : batch.rows
                    const deleted = await pruneAccessLogs(logs, rule.organization_id, query)
                    await query('UPDATE log_processing_cursors SET last_id=$2,updated_at=NOW() WHERE name=$1', [cursorName, batch.rows.at(-1).id])
                    total += deleted.size
                    console.log(JSON.stringify({ source, checkedThrough: batch.rows.at(-1).id, end: cursor.history_end_id, deleted: deleted.size, totalDeletedThisRun: total }))
                })
                // Yield to fresh log processing between short cleanup transactions.
                if (!finished) await Bun.sleep(100)
            }
        }
    }
} finally { await closeDatabase() }
