import ensure from '../src/utils/db/monitoringIssuesSchema.ts'
import { mergeMonitoringCases } from '../src/utils/mergeMonitoringCases.ts'
import { closeDatabase } from '../src/utils/db.ts'
try { await ensure(); console.log(JSON.stringify({ merged: await mergeMonitoringCases() })) } finally { await closeDatabase() }
