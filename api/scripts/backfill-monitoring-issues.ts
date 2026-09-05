import { closeDatabase } from '#db'
import ensureMonitoringIssuesSchema from '#utils/db/monitoringIssuesSchema.ts'
import { backfillMonitoringIssues } from '#utils/monitoringIssues.ts'

try {
    await ensureMonitoringIssuesSchema()
    await backfillMonitoringIssues()
    console.log('Existing monitoring failures are linked to cases. No notifications were sent.')
} finally {
    await closeDatabase()
}
