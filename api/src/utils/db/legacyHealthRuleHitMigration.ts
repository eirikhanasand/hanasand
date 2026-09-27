import run, { withTransaction } from '#db'

const migrationId = 'split-legacy-health-check-rule-hits-v1'
const legacyRuleId = 'custom.a3ffdb72ba7847dda8e9.v1'
const historicalTotal = 672235
const sample = [
    { id: 'custom.ad38553bb1214ade9e25.v1', observed: 209773, percent: '46.28%', explanation: 'Drop routine journalctl --no-pager executions from Hanasand Logs; preserve other process executions.' },
    { id: 'custom.75ab7fc6485c4892b8e1.v1', observed: 219263, percent: '48.38%', explanation: 'Drop routine runc executions from Hanasand Logs; preserve other process executions.' },
    { id: 'custom.7304f6447fad4d769764.v1', observed: 24217, percent: '5.34%', explanation: 'Drop routine wget probes to localhost:3000 from Hanasand Logs; preserve other network and process activity.' },
]
const sampleTotal = sample.reduce((total, item) => total + item.observed, 0)

export function allocateHistoricalRuleHits(total: number) {
    const allocations = sample.map(item => {
        const exact = total * item.observed / sampleTotal
        return { ...item, hits: Math.floor(exact), remainder: exact % 1 }
    })
    const remaining = total - allocations.reduce((sum, item) => sum + item.hits, 0)
    for (const item of [...allocations].sort((a, b) => b.remainder - a.remainder).slice(0, remaining)) item.hits++
    return allocations.map(({ id, hits }) => ({ id, hits }))
}

export default async function ensureLegacyHealthRuleHitMigration() {
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_migrations (
        migration_id TEXT PRIMARY KEY,
        completed_at TIMESTAMPTZ
    )`)
    await withTransaction(async query => {
        await query('INSERT INTO rule_hit_migrations(migration_id) VALUES($1) ON CONFLICT(migration_id) DO NOTHING', [migrationId])
        const state = await query('SELECT completed_at FROM rule_hit_migrations WHERE migration_id=$1 FOR UPDATE', [migrationId])
        if (state.rows[0]?.completed_at) return
        const legacyRules = await query('SELECT organization_id FROM rules WHERE rule_id=$1', [legacyRuleId])
        if (!legacyRules.rows.length) {
            await query('UPDATE rule_hit_migrations SET completed_at=NOW() WHERE migration_id=$1', [migrationId])
            return
        }
        if (legacyRules.rows.length !== 1) throw new Error('Expected one legacy health-check rule to migrate.')
        const organizationId = legacyRules.rows[0].organization_id as string
        const legacy = await query('SELECT hits::text AS hits FROM rule_hit_counts WHERE organization_id=$1 AND source=$2 AND rule_id=$3', [organizationId, 'receipts', legacyRuleId])
        const oldHits = Number(legacy.rows[0]?.hits || 0)
        if (oldHits !== historicalTotal) throw new Error(`Legacy health-check hit total changed; expected ${historicalTotal}, found ${oldHits}.`)
        const newRules = await query('SELECT rule_id FROM rules WHERE organization_id=$1 AND rule_id=ANY($2::text[])', [organizationId, sample.map(item => item.id)])
        if (newRules.rows.length !== sample.length) throw new Error('All three split health-check rules must exist before historical hits are assigned.')
        const allocations = allocateHistoricalRuleHits(oldHits)
        for (const allocation of allocations) {
            const updated = await query('UPDATE rule_hit_counts SET hits=hits+$4 WHERE organization_id=$1 AND source=$2 AND rule_id=$3',
                [organizationId, 'receipts', allocation.id, allocation.hits])
            if (updated.rowCount !== 1) throw new Error(`Missing hit counter for split rule ${allocation.id}.`)
        }
        await query('UPDATE rule_hit_counts SET hits=0 WHERE organization_id=$1 AND source=$2 AND rule_id=$3', [organizationId, 'receipts', legacyRuleId])
        for (const item of sample) {
            const allocated = allocations.find(value => value.id === item.id)!.hits
            await query('UPDATE rules SET explanation=$3, updated_at=NOW() WHERE organization_id=$1 AND rule_id=$2', [
                organizationId, item.id,
                `${item.explanation} Historical hit total includes ${allocated.toLocaleString('en-US')} of the former combined rule's ${oldHits.toLocaleString('en-US')} hits, allocated using the five-minute sample (${item.percent}). Original dropped events are unavailable for event-by-event attribution.`,
            ])
        }
        await query('DELETE FROM rules WHERE organization_id=$1 AND rule_id=$2', [organizationId, legacyRuleId])
        await query('UPDATE rule_hit_migrations SET completed_at=NOW() WHERE migration_id=$1', [migrationId])
    })
}
