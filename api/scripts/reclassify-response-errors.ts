import { randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import { applicationErrorRule, applicationErrorRuleId, applicationErrorDefinition, classifyApplicationError } from '#utils/mill/applicationError.ts'
import { loadConfiguredMillRules } from '../src/handlers/mill.ts'
import { processLogBatch } from '#utils/mill/processLogs.ts'
import type { LogInput } from '#utils/mill/logEvent.ts'

// Reuse canonical ingestion and stable event IDs; retain every source and finding.
const organizationId = process.argv[2]
if (!organizationId) throw new Error('An organization ID is required.')
const organization = await run('SELECT id FROM organizations WHERE id=$1 AND status=\'active\'', [organizationId])
if (!organization.rows.length) throw new Error('Active organization not found.')
await withTransaction(async query => {
    const inserted = await query(`INSERT INTO mill_rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
        VALUES($1,$2,$3,'1',$4,$5,'medium',$6,$7::jsonb,'hanasand',true)
        ON CONFLICT(organization_id,rule_id) DO NOTHING RETURNING id`,
    [randomUUID(), organizationId, applicationErrorRuleId, applicationErrorRule.name, applicationErrorRule.family, applicationErrorRule.explanation, JSON.stringify(applicationErrorDefinition)])
    if (inserted.rows.length) await query(`INSERT INTO system_events(event_type,severity,source,service,object_type,object_id,organization_id,outcome,reason,context)
        VALUES('mill.rule.created','notice','maintenance','hanasand-api','mill_rule',$1,$2,'success',$3,$4::jsonb)`,
    [applicationErrorRuleId, organizationId, 'User requested medium application errors for duplicate response headers.', JSON.stringify({ ruleId: applicationErrorRuleId, after: applicationErrorRule })])
})
const rules = await loadConfiguredMillRules(organizationId)
const rule = rules.find(rule => rule.id === applicationErrorRuleId)
if (!rule?.enabled || rule.severity !== 'medium') throw new Error('The saved rule must be enabled at medium severity.')
const rows = (await run(`SELECT e.id AS event_id,s.* FROM mill_events e JOIN service_logs s ON e.log_key='service:'||s.id::text
    WHERE e.organization_id=$1 AND e.ingestion_id='logs' AND e.normalized->>'service'='hanasand-api'
    AND e.normalized->>'message'=$2 AND e.normalized->>'severity'='critical'
    ORDER BY s.id`, [organizationId, applicationErrorDefinition.conditions[1].value])).rows as (LogInput & { event_id: string })[]
let processed = 0
for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50).map(log => {
        const classification = classifyApplicationError(log, rules)
        if (!classification) throw new Error('An event no longer matches the saved rule.')
        return { ...log, level: classification.level, metadata: classification.metadata }
    })
    await withTransaction(async query => {
        for (const log of batch) await query('UPDATE service_logs SET level=$2,metadata=$3::jsonb WHERE id=$1', [String(log.id), log.level, JSON.stringify(log.metadata)])
        await query('UPDATE mill_events SET processing_status=\'pending\' WHERE organization_id=$1 AND id=ANY($2::text[])', [organizationId, batch.map(log => log.event_id)])
    })
    await processLogBatch(batch, organizationId, rules)
    processed += batch.length
    console.log(JSON.stringify({ reingested: processed, total: rows.length }))
}
await run(`INSERT INTO system_events(event_type,severity,source,service,object_type,object_id,organization_id,outcome,reason,context)
    VALUES('mill.events.reclassified','notice','maintenance','hanasand-api','mill_rule',$1,$2,'success',$3,$4::jsonb)`,
[applicationErrorRuleId, organizationId, 'Reingested duplicate-response errors under the saved classification rule.', JSON.stringify({ ruleId: applicationErrorRuleId, count: processed, eventIds: rows.map(row => row.event_id) })])
console.log(JSON.stringify({ complete: true, reingested: processed }))
process.exit(0)
