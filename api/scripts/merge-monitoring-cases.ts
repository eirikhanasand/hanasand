import ensure from '../src/utils/db/monitoringIssuesSchema.ts'
import { mergeMonitoringCases } from '../src/utils/mergeMonitoringCases.ts'
import run, { closeDatabase } from '../src/utils/db.ts'
try {
    await ensure()
    const ids = process.argv.includes('--service-checks')
        ? (await run('SELECT id FROM agent_automations WHERE target_url LIKE \'https://hanasand.com/api/status?service=%\'')).rows.map(row => row.id as string)
        : undefined
    console.log(JSON.stringify({ merged: await mergeMonitoringCases(ids) }))
} finally { await closeDatabase() }
