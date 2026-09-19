import { closeDatabase, withTransaction } from '../src/utils/db.ts'
import { correlationKey, monitoringScope } from '../src/utils/monitoringCorrelation.ts'
import type { AutomationRow } from '../src/utils/automations.ts'

// Reviewed Hanasand checks only. Do not sweep unrelated personal automations.
const monitoringIds = [
    'monitor-ai-models', 'monitor-ai-inference', 'monitor-ti-collection', 'monitor-ti-enrichment',
    '8eba360e-ae03-44c4-b17f-6fe81e2834f6', '8ff7edee-4b63-43b4-a133-1a3604e90af5', 'e78a217b-1b19-48db-8566-1791a577c91e',
    'a0eb46e3-f2d0-4aa7-a343-c881491cb3b5', '78a582f9-879f-4b48-9169-5a9917c07fde', '16887104-0dbb-4a3f-a76c-470ce0160011',
    ...['cpu', 'gpu', 'power', 'ram', 'storage', 'temperature'].flatMap(kind => ['monitor-host-' + kind, 'monitor-ovh-' + kind]),
    'monitor-mail-relay-inspur', 'monitor-mail-relay-ovh', 'e9693455-8664-4209-afca-56583184f239',
    'monitor-public-search', 'monitor-ti-delivery-reports',
]

export async function assignMonitoringOrganization(ids: string[], owner: string, organization: string, apply = false) {
    return withTransaction(async query => {
        const destination = await query('SELECT id FROM organizations WHERE id=$1 AND status=\'active\'', [organization])
        if (!destination.rows.length) throw new Error('The destination organization must be active.')
        // The scheduled worker must be stopped for --apply so old in-flight snapshots cannot recreate the old scope.
        for (const scope of [null, organization]) await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [monitoringScope({ owner_id: owner, organization_id: scope } as AutomationRow)])
        const monitors = await query('SELECT * FROM agent_automations WHERE id=ANY($1::text[]) FOR UPDATE', [ids])
        if (monitors.rows.length !== ids.length || monitors.rows.some(a => a.owner_id !== owner || a.organization_id && a.organization_id !== organization)) throw new Error('The reviewed monitor set or ownership changed.')
        const mixed = await query(`SELECT 1 FROM monitoring_issue_checks c JOIN monitoring_issues i ON i.id=c.issue_id
            WHERE i.automation_id=ANY($1::text[]) AND NOT(c.automation_id=ANY($1::text[])) LIMIT 1`, [ids])
        if (mixed.rows.length) throw new Error('A shared case contains a check outside the reviewed set.')
        const issues = await query('SELECT * FROM monitoring_issues WHERE automation_id=ANY($1::text[]) FOR UPDATE', [ids])
        if (apply) {
            await query('UPDATE agent_automations SET organization_id=$2,updated_at=NOW() WHERE id=ANY($1::text[])', [ids, organization])
            for (const issue of issues.rows.filter(i => !i.merged_into)) {
                const automation = { ...monitors.rows.find(a => a.id === issue.automation_id), organization_id: organization } as AutomationRow
                const key = await correlationKey(query, automation, issue.fingerprint, issue.kind, issue.summary)
                await query('UPDATE monitoring_issues SET correlation_key=$2 WHERE id=$1', [issue.id, key])
            }
        }
        return { applied: apply, organization, monitors: monitors.rows.length, cases: issues.rows.length }
    })
}

if (import.meta.main) {
    try {
        console.log(await assignMonitoringOrganization(monitoringIds, 'eirikhanasand', '3e735e7b-4d7f-444d-9806-231fa26cfcec', process.argv.includes('--apply')))
    } finally { await closeDatabase() }
}
