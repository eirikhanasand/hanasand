import { expect, test } from 'bun:test'
import { monitorSystemCronJobs } from '../src/utils/systemCronMonitor.ts'
import type { UnifiedScheduledJob } from '../src/utils/systemCron.ts'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'
import { correlationKey } from '../src/utils/monitoringCorrelation.ts'
import { needsSystemAutomationAccess, automationReadScope } from '../src/utils/automationAccess.ts'
import type { AutomationRow } from '../src/utils/automations.ts'

test('fresh blocked and failed jobs are recorded independently; only observed healthy states recover', async () => {
    const observations: unknown[][] = []
    const states = ['blocked', 'failed', 'enabled', 'running', 'observable', 'paused', 'unknown'] as const
    const jobs = states.map(status => ({ id: status, name: `Job ${status}`, status, enabled: false, lastError: 'HTTP 503' } as UnifiedScheduledJob))
    jobs.push({ id: 'api-cron-health-monitor', status: 'running' } as UnifiedScheduledJob)
    const result = await monitorSystemCronJobs(async options => {
        expect(options?.fast).not.toBe(true)
        return jobs
    }, async (...args) => { observations.push(args) })
    expect(result.jobs.map(job => job.id)).toEqual(states.slice(0, 5))
    expect(observations.map(row => (row[2] as { status: string }).status)).toEqual(['down', 'down', 'up', 'up', 'up'])
    expect(observations[0][2]).toMatchObject({ checkId: 'blocked', message: expect.stringContaining('HTTP 503') })
})

test('recording one job failing does not silently skip the other jobs', async () => {
    const visited: string[] = []
    const list = async () => ['a', 'b'].map(id => ({ id, name: id, status: 'blocked' } as UnifiedScheduledJob))
    await expect(monitorSystemCronJobs(list, async (_service, name) => {
        visited.push(name)
        if (name === 'a') throw new Error('Database unavailable')
    })).rejects.toThrow('a: Database unavailable')
    expect(visited).toEqual(['a', 'b'])
})

test('job case identity survives changed blockers and separates a shared backend outage', async () => {
    const job = { id: 'monitor-a', owner_id: 'operator', organization_id: 'platform', target_url: 'system:cron:job-a', monitoring_type: 'fetch' } as AutomationRow
    const other = { ...job, id: 'monitor-b', target_url: 'system:cron:job-b' }
    const key = monitoringIssueFingerprint(job, 'failure', 'HTTP 503')
    expect(key).toBe(monitoringIssueFingerprint(job, 'failure', 'HTTP 401'))
    expect(key).not.toBe(monitoringIssueFingerprint(other, 'failure', 'HTTP 503'))
    const query = (async () => ({ rows: [] })) as never
    const reason = 'connect ECONNREFUSED 127.0.0.1:3000'
    expect(await correlationKey(query, job, key, 'failure', reason)).not.toBe(await correlationKey(query, other, monitoringIssueFingerprint(other, 'failure', reason), 'failure', reason))
    expect(await correlationKey(query, job, key, 'failure', reason)).toBe(await correlationKey(query, job, key, 'failure', 'HTTP 503'))
    expect(needsSystemAutomationAccess({ actionType: 'agent_prompt', targetUrl: job.target_url, organizationId: 'platform', modelName: null })).toBe(true)
    expect(automationReadScope('a', '$1', '$2')).toContain("COALESCE(a.target_url, '') NOT LIKE 'system:cron:%'")
})
