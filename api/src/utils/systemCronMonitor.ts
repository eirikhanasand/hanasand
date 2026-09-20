import { listUnifiedScheduledJobs } from './systemCron.ts'
import { recordServiceCheckCase } from './status/serviceCheckCase.ts'

export async function monitorSystemCronJobs(list = listUnifiedScheduledJobs, record = recordServiceCheckCase) {
    // Await real observations; the fast registry snapshot cannot prove recovery.
    const jobs = await list()
    const checkedAt = new Date().toISOString()
    const results = await Promise.allSettled(jobs.map(async job => {
        if (job.id === 'api-cron-health-monitor' || !['blocked', 'failed', 'enabled', 'running', 'observable', 'paused'].includes(job.status)) return null
        const blocked = job.status === 'blocked' || job.status === 'failed'
        const message = blocked
            ? `${job.name} is ${job.status}. ${job.lastError || 'The job cannot run.'} Review the job and fix the blocker at https://hanasand.com/automation/cron?scope=system.`
            : job.status === 'paused'
                ? `${job.name} is paused. No run is expected while it is paused.`
                : `${job.name} is no longer blocked. Current status: ${job.status}.`
        await record('scheduled-jobs', job.name, { checkId: job.id, status: blocked ? 'down' : 'up', checkedAt, latencyMs: 0, message })
        return { id: job.id, status: job.status }
    }))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${jobs[index].id}: ${result.reason instanceof Error ? result.reason.message : 'Case monitoring failed.'}`] : [])
    if (failures.length) throw new Error(failures.join('\n'))
    return { checkedAt, jobs: results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []) }
}
