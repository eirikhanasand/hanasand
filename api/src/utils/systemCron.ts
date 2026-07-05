import { existsSync } from 'node:fs'
import { readFile, stat, writeFile, chmod, chown } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { getBackgroundJobRuntime, type BackgroundJobRuntime } from './backgroundJobRuntime.ts'
import { getVulnerabilityReport, isVulnerabilityScanActive, setVulnerabilityScannerPaused, startTrackedVulnerabilityScan, VULNERABILITY_SCAN_CADENCE_SECONDS, VULNERABILITY_SCAN_JOB_ID } from './vulnerabilities/scanner.ts'

const execFileAsync = promisify(execFile)
const BEGIN = '# BEGIN HANASAND MANAGED CRON'
const END = '# END HANASAND MANAGED CRON'

export type ManagedCronDefinition = {
    id: string
    name: string
    description: string
    defaultSchedule: string
    command: string
    legacyCommands?: string[]
    host: string
    category?: ScheduledJobCategory
    service?: string
    logPath?: string
}

export type ManagedCronJob = ManagedCronDefinition & {
    schedule: string
    enabled: boolean
    installed: boolean
    lastLogLine: string | null
    lastLogAt: string | null
}

export type ManagedCronUpdate = {
    schedule?: unknown
    enabled?: unknown
    action?: unknown
}

export type ScheduledJobCategory = 'TI / Exposure' | 'Alerts' | 'Mail' | 'Backup/Database' | 'Forgejo' | 'Other/System'
export type ScheduledJobControl = 'pause' | 'resume' | 'enable' | 'disable' | 'edit_schedule' | 'run_now'
export type ScheduledJobStatus = 'running' | 'enabled' | 'paused' | 'failed' | 'blocked' | 'observable' | 'unknown'

export type ScheduledJobTelemetry = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    cpuPercent: number | null
    memoryRssMb: number | null
    memoryUsedMb: number | null
    queueDepth: number | null
    note: string
}

export type ScheduledJobCostEstimate = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    electricityUsdPerKwh: number
    powerWatts: number | null
    hourlyUsd: number | null
    dailyUsd: number | null
    assumption: string
}

export type UnifiedScheduledJob = {
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    source: string
    service: string
    schedule: string
    cadenceSeconds: number | null
    enabled: boolean
    running: boolean
    status: ScheduledJobStatus
    installed?: boolean
    command?: string
    host?: string
    logPath?: string
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastFinishedAt: string | null
    nextRunAt: string | null
    currentRunDurationMs: number | null
    averageRuntimeMs: number | null
    failureCount: number
    lastError: string | null
    logExcerpt: string | null
    controls: ScheduledJobControl[]
    controlMode: 'editable' | 'safe_control' | 'run_only' | 'observable_only'
    resourceUsage: ScheduledJobTelemetry
    costEstimate: ScheduledJobCostEstimate
    assumptions: string[]
}

const CRON_USER = process.env.MANAGED_CRON_USER || process.env.HOST_USER || 'hanasand'
const CRON_SPOOL_DIR = process.env.MANAGED_CRON_SPOOL_DIR || '/host/cron/crontabs'
const MANAGED_LOG_ROOT = process.env.MANAGED_CRON_LOG_ROOT || ''
const CRON_WRITE_USER = process.env.MANAGED_CRON_WRITE_USER || 'bun'
const ELECTRICITY_USD_PER_KWH = Number(process.env.BACKGROUND_JOB_ELECTRICITY_USD_PER_KWH || '0.05')
const API_CRON_CADENCE_SECONDS = 60

export const managedCronDefinitions: ManagedCronDefinition[] = [
    {
        id: 'forgejo-standby-sync',
        name: 'Forgejo standby sync',
        description: 'Repairs Forgejo metadata, copies the active Git service to OVH standby, restores the database, and health-checks the standby.',
        defaultSchedule: '*/5 * * * *',
        command: 'LOG=/home/hanasand/git/standby-sync.log /home/hanasand/git/sync-to-ovh.sh',
        legacyCommands: [
            '/home/hanasand/git/sync-to-ovh.sh',
            'cd /home/hanasand/git && LOCK=/tmp/forgejo-standby-sync.lock LOG=/home/hanasand/git/standby-sync.log bash scripts/sync-to-ovh.sh',
        ],
        host: 'inspur',
        logPath: '/home/hanasand/git/standby-sync.log',
    },
    {
        id: 'forgejo-doctor',
        name: 'Forgejo doctor',
        description: 'Runs Forgejo repository metadata checks and fixes repository HEAD, hook, key, and push-option drift.',
        defaultSchedule: '17 * * * *',
        command: 'cd /home/hanasand/git && LOG_FILE=/home/hanasand/git/forgejo-doctor.log FIX=1 bash scripts/forgejo-doctor.sh',
        host: 'inspur',
        logPath: '/home/hanasand/git/forgejo-doctor.log',
    },
    {
        id: 'db-dashboard-monitor',
        name: 'Database dashboard monitor',
        description: 'Logs in to the production dashboard, verifies live database metrics stay non-zero and explicit, and sends Discord alerts on repeated failure.',
        defaultSchedule: '* * * * *',
        command: '/home/hanasand/hanasand-deploy-clean/ops/db-dashboard-monitor/run-db-dashboard-monitor.sh',
        legacyCommands: [
            '/home/hanasand/hanasand-deploy-64d9339/ops/db-dashboard-monitor/run-db-dashboard-monitor.sh',
            '/home/hanasand/hanasand-deploy-64d9339/ops/db-dashboard-monitor/run-db-dashboard-monitor.sh # id=hanasand-db-dashboard-monitor',
        ],
        host: 'hanasand',
        category: 'Backup/Database',
        service: 'database-monitor',
        logPath: '/home/hanasand/monitor-state/db-dashboard-monitor.log',
    },
]

export function scheduledJobRegistryGuardrailEntries() {
    return [
        ...managedCronDefinitions.map(job => ({ id: job.id, source: 'api/src/utils/systemCron.ts' })),
        ...apiBackgroundJobDefinitions.map(job => ({ id: job.id, source: job.source })),
        { id: 'deployment-compose-schedules', source: 'docker-compose.yml' },
        { id: 'ti-public-canary-collection', source: 'ti/scraper/src/ops/canaryCollection.ts' },
        { id: 'ti-exposure-queue-collection', source: 'ti/scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-exposure-parser', source: 'ti/scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-dwm-alert-generation', source: 'ti/scraper/src/api/dwmWorkflowRoutes.ts' },
        { id: 'ti-source-pack-worker', source: 'ti/scraper/src/api/dwmSourceRequestRoute.ts' },
        { id: 'ti-frontier-queue', source: 'ti/scraper/src/frontier/frontier.ts' },
    ]
}

const apiBackgroundJobDefinitions: Array<{
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    schedule: string
    cadenceSeconds: number | null
    source: string
    controls: ScheduledJobControl[]
}> = [
    {
        id: 'api-hot-cache-refresh',
        name: 'API stats and Docker cache refresh',
        description: 'Refreshes cached API stats and Docker/container snapshots for dashboard resource telemetry.',
        category: 'Other/System',
        schedule: 'Every hot-cache interval',
        cadenceSeconds: null,
        source: 'api/src/utils/refresh/fp.ts',
        controls: [],
    },
    {
        id: 'api-auth-token-cleanup',
        name: 'Expired auth token cleanup',
        description: 'Invalidates stale access tokens from the API process minute cron.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/cron.ts',
        controls: [],
    },
    {
        id: 'api-login-attempt-cleanup',
        name: 'Login attempt cleanup',
        description: 'Expires old failed-login attempt records so auth throttles recover correctly.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/cron.ts',
        controls: [],
    },
    {
        id: 'api-deleted-account-purge',
        name: 'Deleted account purge',
        description: 'Finalizes deferred user-account deletion cleanup from the API scheduler.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/cron.ts',
        controls: [],
    },
    {
        id: 'api-synthetic-monitor',
        name: 'Synthetic status monitor',
        description: 'Runs production status checks used by the dashboard status and traffic surfaces.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/status/monitor.ts',
        controls: [],
    },
    {
        id: 'api-production-log-monitor',
        name: 'Production log monitor',
        description: 'Scans production logs for operator-visible failures and monitor signals.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/status/logMonitors.ts',
        controls: [],
    },
    {
        id: 'api-vm-ensure-running',
        name: 'VM keepalive enforcement',
        description: 'Keeps configured always-running VM and agent targets alive.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/vms/ensureAlwaysRunning.ts',
        controls: [],
    },
    {
        id: VULNERABILITY_SCAN_JOB_ID,
        name: 'Vulnerability image scanner',
        description: 'Discovers running container images, runs Docker Scout CVE scans, persists results, and exposes exact scanner blockers.',
        category: 'Other/System',
        schedule: secondsSchedule(VULNERABILITY_SCAN_CADENCE_SECONDS),
        cadenceSeconds: VULNERABILITY_SCAN_CADENCE_SECONDS,
        source: 'api/src/utils/vulnerabilities/scanner.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: 'api-agent-automations',
        name: 'Agent automation dispatcher',
        description: 'Claims due user/system automations and runs alert, mail, and system actions.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/automations.ts',
        controls: [],
    },
    {
        id: 'api-mail-account-provisioning',
        name: 'Mail account provisioning sync',
        description: 'Reconciles application users with managed mail accounts when mail admin credentials are configured.',
        category: 'Mail',
        schedule: 'Every minute when mail admin is configured',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/mail/accounts.ts',
        controls: [],
    },
    {
        id: 'api-ti-profile-cache-warm',
        name: 'Threat actor profile cache warmer',
        description: 'Refreshes curated TI actor profile cache entries for fast analyst search results.',
        category: 'TI / Exposure',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/ti/search.ts',
        controls: [],
    },
    {
        id: 'api-ti-autonomous-pipeline',
        name: 'Autonomous TI discovery pipeline',
        description: 'Discovers, enriches, and publishes threat actor profile changes in the API database.',
        category: 'TI / Exposure',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/ti/autonomousPipeline.ts',
        controls: [],
    },
]

export async function listManagedCronJobs(): Promise<ManagedCronJob[]> {
    const crontab = await readCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab)

    return Promise.all(managedCronDefinitions.map(async(definition) => {
        const entry = entries.get(definition.id) || existingEntries.get(definition.id)
        const log = await readLastLogLine(definition.logPath)

        return {
            ...definition,
            schedule: entry?.schedule || definition.defaultSchedule,
            enabled: entry ? entry.enabled : false,
            installed: Boolean(entry),
            lastLogLine: log.line,
            lastLogAt: log.createdAt,
        }
    }))
}

export async function listUnifiedScheduledJobs(): Promise<UnifiedScheduledJob[]> {
    const [forgejoJobs, tiJobs] = await Promise.all([
        listManagedCronJobs(),
        listTiScheduledJobs(),
    ])
    const apiDefinitions = apiBackgroundJobDefinitions
        .filter(job => job.id !== 'api-mail-account-provisioning' || Boolean(process.env.MAIL_ADMIN_PASSWORD))
    const apiJobs = await Promise.all(apiDefinitions.map(job => job.id === VULNERABILITY_SCAN_JOB_ID
        ? vulnerabilityScannerJob(job)
        : apiBackgroundJob(job)))
    return [...tiJobs, ...apiJobs, ...forgejoJobs.map(managedHostCronJob)]
}

export async function updateManagedCronJob(id: string, input: ManagedCronUpdate) {
    if (id === VULNERABILITY_SCAN_JOB_ID) {
        if (input.action === 'run_now') {
            void startTrackedVulnerabilityScan().catch(error => {
                console.error('Failed to run vulnerability scanner from Cron Jobs dashboard', error)
            })
        }
        if (input.enabled !== undefined) {
            await setVulnerabilityScannerPaused(!input.enabled)
        }
        return (await listUnifiedScheduledJobs()).find(job => job.id === id)!
    }
    if (id === 'ti-public-canary-collection') {
        await updateTiCollectionScheduler(input)
        return (await listUnifiedScheduledJobs()).find(job => job.id === id)!
    }
    if (id === 'ti-dwm-alert-generation' && input.action === 'run_now') {
        await runTiJob('/v1/dwm/alerts/rebuild', { tenantId: 'default', actor: 'dashboard/system/cron' })
        return (await listUnifiedScheduledJobs()).find(job => job.id === id)!
    }

    const definition = managedCronDefinitions.find(job => job.id === id)
    if (!definition) {
        throw new Error('Managed cron job not found or does not support controls.')
    }

    const schedule = input.schedule === undefined
        ? undefined
        : normalizeSchedule(input.schedule)
    const enabled = input.enabled === undefined
        ? undefined
        : Boolean(input.enabled)
    const crontab = await readCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab)
    for (const [entryId, entry] of existingEntries) {
        if (!entries.has(entryId)) entries.set(entryId, entry)
    }
    const current = entries.get(id)
    entries.set(id, {
        schedule: schedule || current?.schedule || definition.defaultSchedule,
        enabled: enabled ?? current?.enabled ?? true,
    })

    await writeCrontab(replaceManagedBlock(crontab, entries))
    return (await listManagedCronJobs()).find(job => job.id === id)!
}

function managedHostCronJob(job: ManagedCronJob): UnifiedScheduledJob {
    const running = false
    return {
        id: job.id,
        name: job.name,
        description: job.description,
        category: job.category || 'Forgejo',
        source: 'api/src/utils/systemCron.ts',
        service: job.service || 'forgejo',
        schedule: job.schedule,
        cadenceSeconds: cronCadenceSeconds(job.schedule),
        enabled: job.enabled,
        running,
        status: job.enabled ? 'enabled' : 'paused',
        installed: job.installed,
        command: job.command,
        host: job.host,
        logPath: job.logPath,
        lastRunAt: job.lastLogAt,
        lastSuccessAt: job.lastLogAt,
        lastFinishedAt: job.lastLogAt,
        nextRunAt: job.enabled ? nextCronRunAt(job.schedule) : null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: null,
        logExcerpt: job.lastLogLine,
        controls: ['edit_schedule', job.enabled ? 'pause' : 'resume'],
        controlMode: 'editable',
        resourceUsage: unavailableTelemetry('Host cron logs are visible, but per-run CPU/RAM is not exposed by crontab.'),
        costEstimate: costEstimate(8, 'Estimated host-script average draw while scheduled; exact Forgejo cron power is not metered per job.'),
        assumptions: ['Host cron has log timestamps only; runtime and resource usage require shell wrapper metrics.'],
    }
}

function apiBackgroundJob(definition: typeof apiBackgroundJobDefinitions[number]): UnifiedScheduledJob {
    const telemetry = getBackgroundJobRuntime(definition.id)
    return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        source: definition.source,
        service: 'hanasand-api',
        schedule: definition.schedule,
        cadenceSeconds: definition.cadenceSeconds,
        enabled: true,
        running: telemetry.running,
        status: telemetry.running ? 'running' : telemetry.lastError ? 'failed' : 'enabled',
        lastRunAt: telemetry.lastRunAt,
        lastSuccessAt: telemetry.lastSuccessAt,
        lastFinishedAt: telemetry.lastFinishedAt,
        nextRunAt: definition.cadenceSeconds ? new Date(Date.now() + definition.cadenceSeconds * 1000).toISOString() : null,
        currentRunDurationMs: currentDurationMs(telemetry),
        averageRuntimeMs: telemetry.averageRuntimeMs,
        failureCount: telemetry.failureCount,
        lastError: telemetry.lastError,
        logExcerpt: telemetry.logExcerpt,
        controls: definition.controls,
        controlMode: definition.controls.length ? 'safe_control' : 'observable_only',
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: null,
            note: 'API process-level memory; per-cron task CPU/RAM is not available without a worker wrapper.',
        },
        costEstimate: costEstimate(18, 'Estimated shared API process draw; cost is service-level, not per cron task.'),
        assumptions: ['The API minute cron runs all subjobs in one process, so CPU/RAM and power are service-level estimates.'],
    }
}

async function vulnerabilityScannerJob(definition: typeof apiBackgroundJobDefinitions[number]): Promise<UnifiedScheduledJob> {
    const telemetry = getBackgroundJobRuntime(definition.id)
    const report = await getVulnerabilityReport()
    const scan = report.scanStatus
    const enabled = scan.enabled && !scan.paused
    const running = telemetry.running || scan.isRunning || isVulnerabilityScanActive()
    const issue = scan.blocker || scan.lastError || scan.staleReason || telemetry.lastError
    return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        source: definition.source,
        service: 'hanasand-api',
        schedule: scan.schedule || definition.schedule,
        cadenceSeconds: scan.cadenceSeconds || definition.cadenceSeconds,
        enabled,
        running,
        status: running ? 'running' : !enabled ? 'paused' : scan.blocker || scan.stale ? 'blocked' : scan.lastError ? 'failed' : 'enabled',
        lastRunAt: telemetry.lastRunAt || scan.startedAt,
        lastSuccessAt: scan.lastSuccessAt || telemetry.lastSuccessAt,
        lastFinishedAt: scan.finishedAt || telemetry.lastFinishedAt,
        nextRunAt: enabled ? scan.nextRunAt : null,
        currentRunDurationMs: currentDurationMs(telemetry) || (scan.isRunning ? ageMs(scan.startedAt) : null),
        averageRuntimeMs: telemetry.averageRuntimeMs,
        failureCount: scan.failureCount || telemetry.failureCount,
        lastError: issue,
        logExcerpt: scan.logs.at(-1)?.message || issue || telemetry.logExcerpt,
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: scan.targetCount,
            note: 'API process memory plus discovered image target count; per-scan CPU is not available without a scanner worker wrapper.',
        },
        costEstimate: costEstimate(20, 'Estimated shared API process plus scanner subprocess draw while scheduled; exact scanner power is not metered per job.'),
        assumptions: [
            'Pause/resume toggles the persisted scanner schedule flag; already-running scans are allowed to finish.',
            scan.blockerAction || scan.staleReason || 'Docker Scout must be available inside the API container for package-level CVE details.',
        ],
    }
}

async function listTiScheduledJobs(): Promise<UnifiedScheduledJob[]> {
    const base = tiBase()
    if (!base) return tiUnavailableJobs('TI_SCRAPER_API_BASE is not configured.')

    const [scheduler, exposureQueue, parserHealth, alertReadiness, resources, sourcePacks, frontier] = await Promise.all([
        fetchTiJson('/v1/ops/collection-scheduler'),
        fetchTiJson('/v1/dwm/exposure-queue?limit=25'),
        fetchTiJson('/v1/dwm/exposure-parser/health'),
        fetchTiJson('/v1/dwm/alerts/generation-readiness?tenantId=default'),
        fetchTiJson('/v1/ops/resource-snapshot'),
        fetchTiJson('/v1/dwm/source-packs?terms=default'),
        fetchTiJson('/v1/frontier'),
    ])

    const schedulerJson = record(scheduler.json)
    const schedulerState = record(schedulerJson.scheduler)
    const resourceJson = record(resources.json)
    const queueDepth = numberValue(record(resourceJson.queue).queued ?? record(resourceJson.queue).currentItems ?? record(frontier.json).queued)
    const tiTelemetry: ScheduledJobTelemetry = {
        scope: resources.ok ? 'service' : 'unavailable',
        cpuPercent: null,
        memoryRssMb: numberValue(record(resourceJson.memory).rssMb),
        memoryUsedMb: numberValue(record(resourceJson.memory).heapUsedMb),
        queueDepth,
        note: resources.ok
            ? 'TI scraper service-level telemetry; exact per-job CPU/RAM is not exposed.'
            : resources.error || 'TI scraper resource endpoint unavailable.',
    }

    return [
        tiCollectionJob(scheduler, tiTelemetry),
        tiExposureQueueJob(exposureQueue, schedulerJson, tiTelemetry),
        tiExposureParserJob(parserHealth, schedulerJson, tiTelemetry),
        tiAlertGenerationJob(alertReadiness, tiTelemetry),
        tiSourcePackWorkerJob(sourcePacks, tiTelemetry),
        tiFrontierQueueJob(frontier, schedulerState, tiTelemetry),
    ]
}

function tiCollectionJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const scheduler = record(payload.scheduler)
    const running = Boolean(scheduler.running)
    const enabled = result.ok && scheduler.enabled !== false
    const latestRun = record(scheduler.lastRun)
    const failures = arrayValue(payload.failures)
    return {
        id: 'ti-public-canary-collection',
        name: 'Public TI collection loop',
        description: 'Scraper-native recurring collection loop for public CTI, Telegram/public-channel, advisory, and exposure-producing sources.',
        category: 'TI / Exposure',
        source: 'ti/scraper/src/ops/canaryCollection.ts',
        service: 'ti-scraper',
        schedule: secondsSchedule(numberValue(scheduler.intervalSeconds) ?? 300),
        cadenceSeconds: numberValue(scheduler.intervalSeconds) ?? 300,
        enabled,
        running,
        status: result.ok ? running ? 'running' : enabled ? 'enabled' : 'paused' : 'blocked',
        lastRunAt: stringValue(latestRun.createdAt ?? latestRun.updatedAt),
        lastSuccessAt: stringValue(record(scheduler.lastSuccessfulRun).updatedAt),
        lastFinishedAt: stringValue(latestRun.updatedAt),
        nextRunAt: stringValue(scheduler.nextRunAt),
        currentRunDurationMs: running ? ageMs(stringValue(latestRun.createdAt ?? latestRun.updatedAt)) : null,
        averageRuntimeMs: null,
        failureCount: failures.length,
        lastError: failures.length ? stringValue(record(failures[0]).reason) : result.error,
        logExcerpt: latestRun.id ? `${latestRun.status || 'run'}: ${latestRun.captureCount ?? 0} captures, ${latestRun.failedTaskCount ?? 0} failed tasks.` : result.error,
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage,
        costEstimate: costEstimate(75, 'Estimated shared ti-scraper service draw for scraper workers; exact per-job power is unavailable.'),
        assumptions: ['Pause/resume controls toggle the scraper canary collection loop; already-running cycles are not interrupted.'],
    }
}

function tiExposureQueueJob(result: TiFetchResult, schedulerPayload: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const scheduler = record(payload.scheduler)
    const freshness = record(payload.freshness)
    const counts = record(payload.counts)
    const cadenceSeconds = numberValue(scheduler.cadenceSeconds) ?? numberValue(record(schedulerPayload.scheduler).intervalSeconds) ?? 300
    return {
        id: 'ti-exposure-queue-collection',
        name: 'DWM exposure queue collection',
        description: 'Recurring exposure-claim queue populated by metadata-only dark web, public-channel, and advisory captures.',
        category: 'TI / Exposure',
        source: 'ti/scraper/src/api/exposureQueueRoutes.ts',
        service: 'ti-scraper',
        schedule: secondsSchedule(cadenceSeconds),
        cadenceSeconds,
        enabled: result.ok,
        running: false,
        status: result.ok ? payload.status === 'live' ? 'enabled' : 'observable' : 'blocked',
        lastRunAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        lastSuccessAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        lastFinishedAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        nextRunAt: stringValue(freshness.nextExpectedCollection ?? record(schedulerPayload.scheduler).nextRunAt),
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: result.error,
        logExcerpt: result.ok ? `${counts.visible ?? 0} visible claims, ${counts.needsReview ?? 0} need review.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        costEstimate: costEstimate(75, 'Shares the ti-scraper collection service power estimate.'),
        assumptions: ['Exposure queue work is produced by the TI collection loop; no separate destructive queue control is exposed.'],
    }
}

function tiExposureParserJob(result: TiFetchResult, schedulerPayload: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const parser = record(schedulerPayload.parser)
    return {
        id: 'ti-exposure-parser',
        name: 'Exposure parser bridge',
        description: 'Parses exposure claims via Hanasand AI when configured, with a local metadata-safe fallback parser.',
        category: 'TI / Exposure',
        source: 'ti/scraper/src/api/exposureQueueRoutes.ts',
        service: 'ti-scraper',
        schedule: 'On exposure ingest',
        cadenceSeconds: null,
        enabled: result.ok || Boolean(parser.aiEndpointConfigured),
        running: false,
        status: result.ok ? payload.status === 'ready' ? 'enabled' : 'observable' : 'blocked',
        lastRunAt: null,
        lastSuccessAt: result.ok ? stringValue(payload.generatedAt) : null,
        lastFinishedAt: result.ok ? stringValue(payload.generatedAt) : null,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: numberValue(payload.latencyMs),
        failureCount: result.ok ? 0 : 1,
        lastError: stringValue(payload.blocker) ?? result.error,
        logExcerpt: result.ok ? `Parser status ${payload.status}; latency ${payload.latencyMs ?? 'unknown'}ms.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        costEstimate: costEstimate(null, 'Parser power is included in ti-scraper and optional Hanasand AI services; no separate meter is available.'),
        assumptions: ['Parser execution is request-driven from ingestion, not a standalone cron.'],
    }
}

function tiAlertGenerationJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const blockers = arrayValue(payload.blockers ?? payload.blockerCodes)
    const generatedAt = stringValue(payload.generatedAt)
    return {
        id: 'ti-dwm-alert-generation',
        name: 'DWM alert generation readiness',
        description: 'Alert candidate and case-generation readiness for DWM/customer exposure workflows.',
        category: 'Alerts',
        source: 'ti/scraper/src/api/dwmWorkflowRoutes.ts',
        service: 'ti-scraper',
        schedule: 'On watchlist/source changes; manually runnable',
        cadenceSeconds: null,
        enabled: result.ok,
        running: false,
        status: result.ok ? blockers.length ? 'failed' : 'enabled' : 'blocked',
        lastRunAt: generatedAt,
        lastSuccessAt: result.ok && !blockers.length ? generatedAt : null,
        lastFinishedAt: generatedAt,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: blockers.length,
        lastError: blockers.length ? blockers.join('; ') : result.error,
        logExcerpt: result.ok ? `Candidates ${payload.candidateCount ?? 'unknown'}; latest evidence ${payload.latestEvidenceAt ?? 'unknown'}.` : result.error,
        controls: ['run_now'],
        controlMode: 'run_only',
        resourceUsage,
        costEstimate: costEstimate(75, 'Shares the ti-scraper service power estimate.'),
        assumptions: ['Run now calls the existing alert rebuild endpoint; pause is not exposed because alert generation is request-driven.'],
    }
}

function tiSourcePackWorkerJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const readiness = record(payload.readiness)
    const lastRun = record(payload.lastRun)
    return {
        id: 'ti-source-pack-worker',
        name: 'DWM source-pack worker',
        description: 'Builds and verifies DWM source packs and parser family readiness for customer exposure coverage.',
        category: 'TI / Exposure',
        source: 'ti/scraper/src/api/dwmSourceRequestRoute.ts',
        service: 'ti-scraper',
        schedule: 'On source-pack/status requests',
        cadenceSeconds: null,
        enabled: result.ok,
        running: false,
        status: result.ok ? readiness.ready === false ? 'failed' : 'observable' : 'blocked',
        lastRunAt: stringValue(lastRun.updatedAt ?? payload.generatedAt),
        lastSuccessAt: result.ok ? stringValue(lastRun.updatedAt ?? payload.generatedAt) : null,
        lastFinishedAt: stringValue(lastRun.updatedAt ?? payload.generatedAt),
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: arrayValue(readiness.blockers).length,
        lastError: arrayValue(readiness.blockers).join('; ') || result.error,
        logExcerpt: result.ok ? `${record(payload.counts).candidateCount ?? 0} candidates; ${record(payload.counts).packCount ?? 0} packs.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        costEstimate: costEstimate(75, 'Shares the ti-scraper service power estimate.'),
        assumptions: ['Source-pack work is exposed as readiness/status data and is not separately pausable today.'],
    }
}

function tiFrontierQueueJob(result: TiFetchResult, scheduler: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const queued = numberValue(payload.queued) ?? resourceUsage.queueDepth
    return {
        id: 'ti-frontier-queue',
        name: 'TI frontier queue',
        description: 'Internal queued collection tasks, leases, retries, and dead letters used by scraper collection.',
        category: 'TI / Exposure',
        source: 'ti/scraper/src/frontier/frontier.ts',
        service: 'ti-scraper',
        schedule: 'Driven by collection loop and ad hoc TI runs',
        cadenceSeconds: null,
        enabled: true,
        running: Boolean(record(scheduler).running),
        status: result.ok ? queued ? 'running' : 'observable' : 'blocked',
        lastRunAt: null,
        lastSuccessAt: result.ok ? new Date().toISOString() : null,
        lastFinishedAt: result.ok ? new Date().toISOString() : null,
        nextRunAt: stringValue(scheduler.nextRunAt),
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: result.error,
        logExcerpt: result.ok ? `${queued ?? 0} queued task${queued === 1 ? '' : 's'}.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        costEstimate: costEstimate(75, 'Shares the ti-scraper service power estimate.'),
        assumptions: ['Frontier queue control is intentionally observable-only here to avoid interrupting leased work.'],
    }
}

function tiUnavailableJobs(reason: string): UnifiedScheduledJob[] {
    const unavailable = unavailableTelemetry(reason)
    return [
        blockedTiJob('ti-public-canary-collection', 'Public TI collection loop', 'Scraper-native recurring collection loop for public CTI and exposure sources.', 'ti/scraper/src/ops/canaryCollection.ts', ['pause', 'run_now'], unavailable),
        blockedTiJob('ti-exposure-queue-collection', 'DWM exposure queue collection', 'Recurring exposure-claim queue populated by TI captures.', 'ti/scraper/src/api/exposureQueueRoutes.ts', [], unavailable),
        blockedTiJob('ti-exposure-parser', 'Exposure parser bridge', 'Exposure claim parser status for Hanasand AI/local fallback parsing.', 'ti/scraper/src/api/exposureQueueRoutes.ts', [], unavailable),
        blockedTiJob('ti-dwm-alert-generation', 'DWM alert generation readiness', 'Alert candidate and case-generation readiness for DWM workflows.', 'ti/scraper/src/api/dwmWorkflowRoutes.ts', ['run_now'], unavailable, 'Alerts'),
        blockedTiJob('ti-source-pack-worker', 'DWM source-pack worker', 'Source-pack and parser-family readiness worker.', 'ti/scraper/src/api/dwmSourceRequestRoute.ts', [], unavailable),
        blockedTiJob('ti-frontier-queue', 'TI frontier queue', 'Internal scraper collection task queue.', 'ti/scraper/src/frontier/frontier.ts', [], unavailable),
    ]
}

function blockedTiJob(id: string, name: string, description: string, source: string, controls: ScheduledJobControl[], resourceUsage: ScheduledJobTelemetry, category: ScheduledJobCategory = 'TI / Exposure'): UnifiedScheduledJob {
    return {
        id,
        name,
        description,
        category,
        source,
        service: 'ti-scraper',
        schedule: 'Unavailable',
        cadenceSeconds: null,
        enabled: false,
        running: false,
        status: 'blocked',
        lastRunAt: null,
        lastSuccessAt: null,
        lastFinishedAt: null,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 1,
        lastError: resourceUsage.note,
        logExcerpt: resourceUsage.note,
        controls,
        controlMode: controls.includes('run_now') && controls.length === 1 ? 'run_only' : controls.length ? 'safe_control' : 'observable_only',
        resourceUsage,
        costEstimate: costEstimate(null, 'TI backend unavailable; cost cannot be estimated from live service state.'),
        assumptions: ['Registry entry is present so this scheduled work remains discoverable even when the scraper API is down.'],
    }
}

function normalizeSchedule(value: unknown) {
    const schedule = String(value || '').trim().replace(/\s+/g, ' ')
    const fields = schedule.split(' ')
    if (fields.length !== 5) {
        throw new Error('Cron schedule must contain exactly five fields.')
    }
    if (!fields.every(field => /^[\d*/,-]+$/.test(field))) {
        throw new Error('Cron schedule contains unsupported characters.')
    }
    return schedule
}

async function readCrontab() {
    const spoolPath = hostCrontabPath()
    if (spoolPath && existsSync(spoolPath)) {
        return readFile(spoolPath, 'utf8')
    }

    try {
        const { stdout } = await execFileAsync('crontab', ['-l'])
        return stdout
    } catch {
        return ''
    }
}

async function writeCrontab(content: string) {
    const normalized = content.trimEnd() + '\n'
    const spoolPath = hostCrontabPath()

    if (spoolPath && existsSync(CRON_SPOOL_DIR)) {
        let uid = Number(process.env.MANAGED_CRON_UID || 1000)
        let gid = Number(process.env.MANAGED_CRON_GID || 1000)
        if (existsSync(spoolPath)) {
            const current = await stat(spoolPath)
            uid = current.uid
            gid = current.gid
        }
        try {
            await writeFile(spoolPath, normalized, 'utf8')
        } catch (error) {
            if (!isAccessError(error)) throw error
            await writeFileAsOwner(spoolPath, normalized)
        }
        await chmod(spoolPath, 0o600).catch(() => undefined)
        await chown(spoolPath, uid, gid).catch(() => undefined)
        return
    }

    await writeCrontabCommand(normalized)
}

function hostCrontabPath() {
    return CRON_SPOOL_DIR ? `${CRON_SPOOL_DIR}/${CRON_USER}` : ''
}

function parseManagedBlock(crontab: string) {
    const entries = new Map<string, { schedule: string, enabled: boolean }>()
    const block = extractManagedBlock(crontab)
    if (!block) return entries

    let pendingId = ''
    for (const rawLine of block.split('\n')) {
        const line = rawLine.trim()
        const idMatch = line.match(/^#\s*id=([A-Za-z0-9_-]+)/)
        if (idMatch) {
            pendingId = idMatch[1]
            continue
        }
        if (!pendingId || !line) continue
        const enabled = !line.startsWith('#')
        const activeLine = enabled ? line : line.replace(/^#\s*/, '')
        const parts = activeLine.split(/\s+/)
        if (parts.length < 6) continue
        entries.set(pendingId, {
            schedule: parts.slice(0, 5).join(' '),
            enabled,
        })
        pendingId = ''
    }
    return entries
}

function parseExistingCronEntries(crontab: string) {
    const entries = new Map<string, { schedule: string, enabled: boolean }>()
    const managedFreeCrontab = removeManagedBlock(crontab)

    for (const rawLine of managedFreeCrontab.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const parts = line.split(/\s+/)
        if (parts.length < 6) continue

        const schedule = parts.slice(0, 5).join(' ')
        const command = parts.slice(5).join(' ')
        const definition = managedCronDefinitions.find(job => job.command === command || job.legacyCommands?.includes(command))
        if (!definition) continue

        entries.set(definition.id, {
            schedule,
            enabled: true,
        })
    }

    return entries
}

function extractManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return ''
    return crontab.slice(start + BEGIN.length, end)
}

function replaceManagedBlock(crontab: string, entries: Map<string, { schedule: string, enabled: boolean }>) {
    const unmanaged = removeManagedCronLines(removeManagedBlock(crontab)).trimEnd()
    const block = renderManagedBlock(entries)
    return [unmanaged, block].filter(Boolean).join('\n\n')
}

function removeManagedCronLines(crontab: string) {
    const commands = new Set(managedCronDefinitions.flatMap(job => [job.command, ...(job.legacyCommands || [])]))
    return crontab
        .split('\n')
        .filter(rawLine => {
            const line = rawLine.trim()
            if (!line || line.startsWith('#')) return true
            const parts = line.split(/\s+/)
            if (parts.length < 6) return true
            return !commands.has(parts.slice(5).join(' '))
        })
        .join('\n')
}

function removeManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return crontab
    return `${crontab.slice(0, start)}${crontab.slice(end + END.length)}`.trim()
}

function renderManagedBlock(entries: Map<string, { schedule: string, enabled: boolean }>) {
    const lines = [BEGIN, '# Managed by Hanasand. Edit from the dashboard or source-controlled defaults.']
    for (const definition of managedCronDefinitions) {
        const entry = entries.get(definition.id) || {
            schedule: definition.defaultSchedule,
            enabled: false,
        }
        lines.push(`# id=${definition.id} name=${definition.name}`)
        lines.push(`${entry.enabled ? '' : '# '}${entry.schedule} ${definition.command}`)
    }
    lines.push(END)
    return lines.join('\n')
}

async function readLastLogLine(logPath?: string) {
    if (!logPath) return { line: null, createdAt: null }
    const hostPath = toHostPath(logPath)
    if (!hostPath) return { line: null, createdAt: null }
    if (!existsSync(hostPath)) return { line: null, createdAt: null }
    try {
        const [contents, details] = await Promise.all([
            readFile(hostPath, 'utf8'),
            stat(hostPath),
        ])
        const lines = contents.trim().split('\n').filter(Boolean)
        return {
            line: lines.at(-1) || null,
            createdAt: details.mtime.toISOString(),
        }
    } catch {
        return { line: null, createdAt: null }
    }
}

function toHostPath(path: string) {
    if (path.startsWith('/home/')) {
        return MANAGED_LOG_ROOT ? `${MANAGED_LOG_ROOT}${path.slice('/home'.length)}` : ''
    }
    return path
}

function writeCrontabCommand(content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('crontab', ['-'], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `crontab exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function writeFileAsOwner(path: string, content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('su', [CRON_WRITE_USER, '-s', '/bin/sh', '-c', `umask 077; cat > ${shellQuote(path)}`], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `owner write exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function shellQuote(value: string) {
    return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

function isAccessError(error: unknown) {
    return error && typeof error === 'object' && 'code' in error && error.code === 'EACCES'
}

type TiFetchResult = {
    ok: boolean
    status: number
    json: unknown
    error: string | null
}

async function fetchTiJson(path: string): Promise<TiFetchResult> {
    const base = tiBase()
    if (!base) return { ok: false, status: 0, json: {}, error: 'TI_SCRAPER_API_BASE is not configured.' }
    try {
        const response = await fetch(new URL(path, base), {
            cache: 'no-store',
            signal: AbortSignal.timeout(6000),
        })
        const text = await response.text()
        let json: unknown = {}
        try {
            json = text ? JSON.parse(text) : {}
        } catch {
            json = { body: text }
        }
        return { ok: response.ok, status: response.status, json, error: response.ok ? null : `TI scraper returned ${response.status}` }
    } catch (error) {
        return { ok: false, status: 0, json: {}, error: error instanceof Error ? error.message : String(error) }
    }
}

async function updateTiCollectionScheduler(input: ManagedCronUpdate) {
    const action = input.action === 'run_now'
        ? 'run_now'
        : input.enabled === true
            ? 'resume'
            : input.enabled === false
                ? 'pause'
                : ''

    if (!action) {
        throw new Error('TI collection scheduler requires enabled=true, enabled=false, or action=run_now.')
    }

    await runTiJob('/v1/ops/collection-scheduler', {
        action,
        operatorApproval: true,
        approvedBy: 'dashboard/system/cron',
        reason: tiCollectionControlReason(action),
    })
}

function tiCollectionControlReason(action: 'pause' | 'resume' | 'run_now') {
    if (action === 'run_now') return 'Run now requested from Cron Jobs dashboard.'
    return action === 'resume'
        ? 'Resume requested from Cron Jobs dashboard.'
        : 'Pause requested from Cron Jobs dashboard.'
}

async function runTiJob(path: string, body: unknown) {
    const base = tiBase()
    if (!base) {
        throw new Error('TI_SCRAPER_API_BASE is not configured.')
    }
    const response = await fetch(new URL(path, base), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `TI scraper returned ${response.status}`)
    }
}

function tiBase() {
    return process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '') || ''
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    return Number.isFinite(number) ? number : null
}

function mb(bytes: number) {
    return Math.round(bytes / 1024 / 1024)
}

function currentDurationMs(telemetry: BackgroundJobRuntime) {
    return telemetry.running && telemetry.currentRunStartedAt ? ageMs(telemetry.currentRunStartedAt) : null
}

function ageMs(iso: string | null) {
    if (!iso) return null
    const time = Date.parse(iso)
    return Number.isFinite(time) ? Math.max(0, Date.now() - time) : null
}

function secondsSchedule(seconds: number) {
    if (seconds < 60) return `Every ${seconds} seconds`
    const minutes = Math.round(seconds / 60)
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`
}

function unavailableTelemetry(note: string): ScheduledJobTelemetry {
    return {
        scope: 'unavailable',
        cpuPercent: null,
        memoryRssMb: null,
        memoryUsedMb: null,
        queueDepth: null,
        note,
    }
}

function costEstimate(powerWatts: number | null, assumption: string): ScheduledJobCostEstimate {
    const hourlyUsd = powerWatts === null ? null : (powerWatts / 1000) * ELECTRICITY_USD_PER_KWH
    return {
        scope: powerWatts === null ? 'unavailable' : 'service',
        electricityUsdPerKwh: ELECTRICITY_USD_PER_KWH,
        powerWatts,
        hourlyUsd: hourlyUsd === null ? null : roundMoney(hourlyUsd),
        dailyUsd: hourlyUsd === null ? null : roundMoney(hourlyUsd * 24),
        assumption,
    }
}

function roundMoney(value: number) {
    return Math.round(value * 10000) / 10000
}

function cronCadenceSeconds(schedule: string) {
    const parts = schedule.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const minute = parts[0]
    if (minute === '*') return 60
    const every = minute.match(/^\*\/(\d+)$/)
    if (every) return Number(every[1]) * 60
    return 3600
}

function nextCronRunAt(schedule: string) {
    const cadence = cronCadenceSeconds(schedule)
    if (!cadence) return null
    return new Date(Date.now() + cadence * 1000).toISOString()
}
