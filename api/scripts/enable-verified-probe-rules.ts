import { closeDatabase, withTransaction } from '#db'
import { modelDiscoveryRule, modelDiscoveryDefinition, modelDiscoveryConfigured } from '../src/utils/mill/analyzeModelDiscovery.ts'
import { readinessAuditRule, readinessAuditDefinition, readinessAuditConfigured } from '../src/utils/mill/analyzeReadinessAudit.ts'

// Explicit deployment action, never a startup migration: later user Disable or
// Store choices must survive every restart. Run after native proof verification.
const candidates = [
    { rule: modelDiscoveryRule, definition: modelDiscoveryDefinition, configured: modelDiscoveryConfigured },
    { rule: readinessAuditRule, definition: readinessAuditDefinition, configured: readinessAuditConfigured },
]
const requested = process.argv.slice(2)
if (!requested.length || requested.some(id => !candidates.some(item => item.rule.id === id))) {
    throw new Error('Specify the verified probe rule IDs to enable.')
}
const selected = candidates.filter(item => requested.includes(item.rule.id))
if (selected.some(item => !item.configured())) throw new Error('Probe verification configuration is missing or invalid.')

const enabled = await withTransaction(async query => {
    const scope = await query(`SELECT id FROM organizations WHERE status='active'
        AND (id=$1 OR ($1::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    const organizationId = scope.rows[0]?.id
    if (!organizationId) throw new Error('Active platform organization not found.')
    const result: { ruleId: string, version: string }[] = []
    for (const { rule, definition } of selected) {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`mill-rule:${organizationId}:${rule.id}`])
        const current = await query('SELECT * FROM mill_rules WHERE organization_id=$1 AND rule_id=$2 FOR UPDATE', [organizationId, rule.id])
        const row = current.rows[0]
        if (!row || row.source !== 'hanasand') throw new Error('Expected installed platform probe rule.')
        const before = { name: row.name, explanation: row.explanation, severity: row.severity, enabled: row.enabled, definition: row.definition, version: String(row.version) }
        const after = { name: rule.name, explanation: rule.explanation, severity: 'low', enabled: true,
            definition: { ...definition, action: 'drop' }, version: String(Number(row.version) + 1) }
        if (before.enabled && before.definition.action === 'drop' && before.explanation === after.explanation) {
            result.push({ ruleId: rule.id, version: before.version })
            continue
        }
        await query(`UPDATE mill_rules SET name=$3,explanation=$4,severity='low',enabled=true,definition=$5::jsonb,version=$6,updated_at=NOW()
            WHERE organization_id=$1 AND rule_id=$2`, [organizationId, rule.id, after.name, after.explanation, JSON.stringify(after.definition), after.version])
        await query(`INSERT INTO system_events(event_type,source,object_type,object_id,organization_id,context)
            VALUES('mill.rule.updated','mill','mill_rule',$1,$2,$3::jsonb)`, [rule.id, organizationId,
            JSON.stringify({ ruleId: rule.id, before, after, reason: 'User-requested activation after native probe identity verification.' })])
        result.push({ ruleId: rule.id, version: after.version })
    }
    return result
}).finally(closeDatabase)
console.log(JSON.stringify({ enabled }))
