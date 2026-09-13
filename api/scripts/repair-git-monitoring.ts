import run, { closeDatabase, withTransaction } from '../src/utils/db.ts'
import ensure from '../src/utils/db/monitoringIssuesSchema.ts'
import { mergeMonitoringCases } from '../src/utils/mergeMonitoringCases.ts'

// Maintenance entry point for HA-28666 / HA-28667; stop the scheduled worker before running.
try {
    await ensure()
    const merged = await mergeMonitoringCases()
    const adjusted = await withTransaction(async query => {
        const checks = await query(`UPDATE agent_automations SET timeout_seconds=5, updated_at=NOW()
            WHERE owner_id='eirikhanasand' AND organization_id IS NULL AND timeout_seconds=1 AND
            ((id='8eba360e-ae03-44c4-b17f-6fe81e2834f6' AND target_url='https://git.hanasand.com/eirikhanasand/hanasand.git/info/refs?service=git-upload-pack')
            OR (id='8ff7edee-4b63-43b4-a133-1a3604e90af5' AND target_url='https://git.hanasand.com')) RETURNING id`)
        if (checks.rows.length) await query(`UPDATE monitoring_issues SET history=history || jsonb_build_array(jsonb_build_object(
            'id',gen_random_uuid()::text,'at',NOW(),'actor','Monitoring repair','actorType','automation','action','configuration_changed',
            'note','Reproduced Bun reporting an expired request deadline as ECONNREFUSED. Timeout classification is now corrected. Git checks use a five-second deadline instead of one second; original event evidence is unchanged.'))
            WHERE id IN (SELECT COALESCE(merged_into,id) FROM monitoring_issues WHERE id IN (28666,28667))`)
        return checks.rows.map(row => row.id)
    })
    const evidence = await run(`SELECT i.id,i.merged_into,i.occurrences,(SELECT count(*) FROM agent_automation_runs r WHERE r.issue_id=i.id) AS events
        FROM monitoring_issues i WHERE id IN (28666,28667)`)
    console.log(JSON.stringify({ merged, adjusted, evidence: evidence.rows }))
} finally { await closeDatabase() }
