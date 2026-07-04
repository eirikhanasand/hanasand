import run from '#db'
import { deliverDiscordWebhookFile, discordWebhookFileModelLabel, redactSecretBearingText } from '#utils/alerts/discordWebhookFile.ts'
import { getMailHealth } from '#utils/mail/health.ts'
import { listGptClients, requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

export type AutomationScheduleKind = 'once' | 'interval'
export type AutomationStatus = 'active' | 'paused' | 'archived'
export type AutomationActionType = 'agent_prompt' | 'echo' | 'mail_health_check' | 'system_alert'

export type AutomationRow = {
    id: string
    owner_id: string
    name: string
    prompt: string
    schedule_kind: AutomationScheduleKind
    interval_minutes: number | null
    run_at: string | null
    status: AutomationStatus
    action_type: AutomationActionType
    timezone: string
    model_name: string | null
    notify_on: 'never' | 'failure' | 'always'
    next_run_at: string | null
    last_run_at: string | null
    last_completed_at: string | null
    last_status: string | null
    last_result: string | null
    last_error: string | null
    consecutive_failures: number
    paused_reason: string | null
    run_count: number
    created_at: string
    updated_at: string
}

export type AutomationRunRow = {
    id: string
    automation_id: string
    owner_id: string
    status: 'running' | 'completed' | 'failed'
    result: string | null
    error: string | null
    provider: string | null
    model: string | null
    started_at: string
    completed_at: string | null
    duration_ms: number | null
}

export type AutomationInput = {
    name?: unknown
    prompt?: unknown
    scheduleKind?: unknown
    schedule_kind?: unknown
    intervalMinutes?: unknown
    interval_minutes?: unknown
    runAt?: unknown
    run_at?: unknown
    status?: unknown
    actionType?: unknown
    action_type?: unknown
    timezone?: unknown
    modelName?: unknown
    model_name?: unknown
    notifyOn?: unknown
    notify_on?: unknown
}

type NormalizedAutomationInput = {
    name: string
    prompt: string
    scheduleKind: AutomationScheduleKind
    intervalMinutes: number | null
    runAt: Date | null
    status: AutomationStatus
    actionType: AutomationActionType
    timezone: string
    modelName: string | null
    notifyOn: 'never' | 'failure' | 'always'
    nextRunAt: Date | null
}

const ACTIVE_STATUSES = new Set(['active', 'paused', 'archived'])
const ACTION_TYPES = new Set(['agent_prompt', 'echo', 'mail_health_check', 'system_alert'])
const NOTIFY_OPTIONS = new Set(['never', 'failure', 'always'])
const MAX_AUTOMATION_RUNTIME_MS = 10 * 60_000
const STALE_RUNNING_AFTER_MS = MAX_AUTOMATION_RUNTIME_MS + 2 * 60_000

export function toAutomation(row: AutomationRow) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        prompt: row.prompt,
        scheduleKind: row.schedule_kind,
        intervalMinutes: row.interval_minutes,
        runAt: row.run_at,
        status: row.status,
        actionType: row.action_type,
        timezone: row.timezone,
        modelName: row.model_name,
        notifyOn: row.notify_on,
        nextRunAt: row.next_run_at,
        lastRunAt: row.last_run_at,
        lastCompletedAt: row.last_completed_at,
        lastStatus: row.last_status,
        lastResult: row.last_result,
        lastError: row.last_error,
        consecutiveFailures: row.consecutive_failures,
        pausedReason: row.paused_reason,
        runCount: row.run_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export function toAutomationRun(row: AutomationRunRow) {
    return {
        id: row.id,
        automationId: row.automation_id,
        ownerId: row.owner_id,
        status: row.status,
        result: row.result,
        error: row.error,
        provider: row.provider,
        model: row.model,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationMs: row.duration_ms,
    }
}

export function normalizeAutomationInput(input: AutomationInput, existing?: AutomationRow): NormalizedAutomationInput {
    const name = clean(input.name) || existing?.name || 'Agent automation'
    const prompt = clean(input.prompt) || existing?.prompt || ''
    const scheduleKind = parseScheduleKind(input.scheduleKind ?? input.schedule_kind ?? existing?.schedule_kind)
    const intervalMinutes = parseIntervalMinutes(input.intervalMinutes ?? input.interval_minutes ?? existing?.interval_minutes, scheduleKind)
    const runAt = parseRunAt(input.runAt ?? input.run_at ?? existing?.run_at, scheduleKind)
    const status = parseStatus(input.status ?? existing?.status)
    const actionType = parseActionType(input.actionType ?? input.action_type ?? existing?.action_type)
    const timezone = parseTimezone(input.timezone ?? existing?.timezone)
    const modelName = clean(input.modelName ?? input.model_name ?? existing?.model_name) || null
    const notifyOn = parseNotifyOn(input.notifyOn ?? input.notify_on ?? existing?.notify_on)
    const nextRunAt = status === 'active' ? computeNextRunAt({ scheduleKind, intervalMinutes, runAt, from: new Date() }) : null

    if (!prompt) {
        throw new Error('Prompt is required.')
    }

    if (status === 'active' && actionType === 'system_alert' && !modelName) {
        throw new Error('System alerts need a delivery destination before activation.')
    }

    if (status === 'active' && actionType === 'mail_health_check' && notifyOn !== 'never' && !modelName) {
        throw new Error('Mail health alerts need a delivery destination before activation.')
    }

    return { name, prompt, scheduleKind, intervalMinutes, runAt, status, actionType, timezone, modelName, notifyOn, nextRunAt }
}

export function computeNextRunAt({
    scheduleKind,
    intervalMinutes,
    runAt,
    from,
}: {
    scheduleKind: AutomationScheduleKind
    intervalMinutes: number | null
    runAt: Date | null
    from: Date
}) {
    if (scheduleKind === 'once') {
        return runAt && runAt.getTime() >= from.getTime() - 1000 ? runAt : null
    }

    const minutes = Math.max(1, intervalMinutes || 60)
    return new Date(from.getTime() + minutes * 60_000)
}

export async function runDueAutomations() {
    await recoverStaleAutomationRuns()

    const claimResult = await run(`
        UPDATE agent_automations
           SET last_run_at = NOW(),
               last_status = 'running',
               last_error = NULL,
               updated_at = NOW()
         WHERE id IN (
            SELECT id
            FROM agent_automations
            WHERE status = 'active'
              AND next_run_at IS NOT NULL
              AND next_run_at <= NOW()
              AND COALESCE(last_status, '') <> 'running'
            ORDER BY next_run_at ASC
            LIMIT 3
            FOR UPDATE SKIP LOCKED
         )
         RETURNING *
    `)

    await Promise.all((claimResult.rows as AutomationRow[]).map(executeAutomation))
}

export async function recoverStaleAutomationRuns() {
    const staleAfter = new Date(Date.now() - STALE_RUNNING_AFTER_MS)
    const staleRuns = await run(`
        UPDATE agent_automation_runs
           SET status = 'failed',
               error = 'Automation exceeded the maximum runtime and was recovered by the scheduler.',
               completed_at = NOW(),
               duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INT * 1000
         WHERE status = 'running'
           AND started_at < $1
         RETURNING automation_id
    `, [staleAfter])

    if (!staleRuns.rows.length) return

    await run(`
        UPDATE agent_automations automation
           SET last_status = 'failed',
               last_error = 'Automation exceeded the maximum runtime and was recovered by the scheduler.',
               last_completed_at = NOW(),
               last_run_at = NULL,
               next_run_at = CASE
                   WHEN automation.schedule_kind = 'interval' AND automation.status = 'active' THEN NOW()
                   ELSE automation.next_run_at
               END,
               consecutive_failures = consecutive_failures + 1,
               updated_at = NOW()
          FROM (
              SELECT DISTINCT automation_id
              FROM agent_automation_runs
              WHERE status = 'failed'
                AND error = 'Automation exceeded the maximum runtime and was recovered by the scheduler.'
                AND completed_at > NOW() - INTERVAL '5 minutes'
          ) stale
         WHERE automation.id = stale.automation_id
    `)
}

export async function executeAutomation(automation: AutomationRow) {
    const runId = crypto.randomUUID()
    const startedAt = Date.now()
    await run(`
        INSERT INTO agent_automation_runs (id, automation_id, owner_id, status)
        VALUES ($1, $2, $3, 'running')
    `, [runId, automation.id, automation.owner_id])

    try {
        const result = await runAutomationAction(automation)
        const durationMs = Date.now() - startedAt
        const nextRunAt = automation.schedule_kind === 'interval'
            ? computeNextRunAt({
                scheduleKind: automation.schedule_kind,
                intervalMinutes: automation.interval_minutes,
                runAt: null,
                from: new Date(),
            })
            : null
        await run(`
            UPDATE agent_automation_runs
               SET status = 'completed',
                   result = $2,
                   provider = $3,
                   model = $4,
                   completed_at = NOW(),
                   duration_ms = $5
             WHERE id = $1
        `, [runId, result.message, result.provider, result.model, durationMs])
        await run(`
            UPDATE agent_automations
               SET next_run_at = $2,
                   last_completed_at = NOW(),
                   last_status = 'completed',
                   last_result = $3,
                   last_error = NULL,
                   consecutive_failures = 0,
                   paused_reason = NULL,
                   run_count = run_count + 1,
                   updated_at = NOW()
             WHERE id = $1
        `, [automation.id, nextRunAt, result.message])
    } catch (error) {
        const durationMs = Date.now() - startedAt
        const message = error instanceof Error ? error.message : 'Automation run failed.'
        const nextRunAt = automation.schedule_kind === 'interval'
            ? computeNextRunAt({
                scheduleKind: automation.schedule_kind,
                intervalMinutes: automation.interval_minutes,
                runAt: null,
                from: new Date(),
            })
            : null
        await run(`
            UPDATE agent_automation_runs
               SET status = 'failed',
                   error = $2,
                   completed_at = NOW(),
                   duration_ms = $3
             WHERE id = $1
        `, [runId, message, durationMs])
        await run(`
            UPDATE agent_automations
               SET status = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' THEN 'paused' ELSE status END,
                   next_run_at = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' THEN NULL ELSE $2 END,
                   last_completed_at = NOW(),
                   last_status = 'failed',
                   last_error = $3,
                   consecutive_failures = consecutive_failures + 1,
                   paused_reason = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' THEN 'Paused after 3 consecutive failures.' ELSE paused_reason END,
                   run_count = run_count + 1,
                   updated_at = NOW()
             WHERE id = $1
        `, [automation.id, nextRunAt, message])
    }
}

async function runAutomationAction(automation: AutomationRow) {
    if (automation.action_type === 'echo') {
        return {
            provider: 'hanasand-automation',
            model: 'echo',
            message: `Echo completed at ${new Date().toISOString()}: ${automation.prompt}`,
        }
    }

    if (automation.action_type === 'mail_health_check') {
        const health = await getMailHealth().catch(error => ({
            status: 'error' as const,
            checkedAt: new Date().toISOString(),
            queueDepth: 0,
            smtpBannerLatencyMs: null,
            checks: [{
                id: 'mail-overview',
                label: 'Mail overview',
                status: 'error' as const,
                detail: error instanceof Error ? redactSecretBearingText(error.message) : 'Mail health check failed.',
            }],
        }))
        const unhealthyChecks = health.checks.filter(check => check.status !== 'healthy')
        const summary = [
            `Mail health ${health.status} at ${health.checkedAt}.`,
            unhealthyChecks.length
                ? `Issues: ${unhealthyChecks.map(check => `${check.label}: ${check.detail}`).join('; ')}`
                : 'All checks are healthy.',
        ].join(' ')

        if (health.status !== 'healthy' || automation.notify_on === 'always') {
            await deliverDiscordIfConfigured(automation, `Hanasand mail alert: ${summary}`)
        }

        return {
            provider: 'hanasand-alerts',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'mail-health',
            message: summary,
        }
    }

    if (automation.action_type === 'system_alert') {
        await deliverDiscordIfConfigured(automation, `Hanasand alert: ${automation.prompt}`)
        return {
            provider: 'hanasand-alerts',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'system-alert',
            message: 'System alert delivered.',
        }
    }

    const clients = listGptClients('gpt')
    const availableClients = clients.filter((client) => client.model.status !== 'error')
    const preferredClient = automation.model_name
        ? availableClients.find((client) => client.name === automation.model_name)
        : availableClients
            .sort((left, right) => (right.model.tps || 0) - (left.model.tps || 0))[0]

    if (!preferredClient) {
        throw new Error('No Hanasand AI model client is connected.')
    }

    const completion = await withAutomationTimeout(requestGptCompletion('gpt', {
        conversationId: `automation-${automation.id}-${crypto.randomUUID()}`,
        clientName: preferredClient.name,
        maxTokens: 1800,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: [
                    'You are a Hanasand scheduled agent.',
                    'Run the user automation and return a concise result that can be shown later in the app.',
                    'The user may not have any app open right now, so include what you checked, changed, or could not do.',
                ].join(' '),
            },
            { role: 'user', content: automation.prompt },
        ],
    }))

    return {
        provider: 'hanasand-ai',
        model: preferredClient.name,
        message: completion.content || 'Automation completed without a text result.',
    }
}

async function deliverDiscordIfConfigured(automation: AutomationRow, content: string) {
    await deliverDiscordWebhookFile(automation.model_name, content)
}

async function withAutomationTimeout<T>(promise: Promise<T>) {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                    reject(new Error('Automation exceeded the maximum runtime.'))
                }, MAX_AUTOMATION_RUNTIME_MS)
            }),
        ])
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function parseScheduleKind(value: unknown): AutomationScheduleKind {
    return value === 'once' ? 'once' : 'interval'
}

function parseIntervalMinutes(value: unknown, scheduleKind: AutomationScheduleKind) {
    if (scheduleKind !== 'interval') return null
    const minutes = Number(value)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 43_200) {
        throw new Error('Interval automations need 1 to 43200 minutes between runs.')
    }
    return Math.round(minutes)
}

function parseRunAt(value: unknown, scheduleKind: AutomationScheduleKind) {
    if (scheduleKind !== 'once') return null
    const raw = clean(value)
    const date = raw ? new Date(raw) : new Date(Date.now() + 60_000)
    if (!Number.isFinite(date.getTime())) {
        throw new Error('Run time must be a valid date.')
    }
    return date
}

function parseStatus(value: unknown): AutomationStatus {
    const status = clean(value)
    return ACTIVE_STATUSES.has(status) ? status as AutomationStatus : 'active'
}

function parseActionType(value: unknown): AutomationActionType {
    const actionType = clean(value)
    return ACTION_TYPES.has(actionType) ? actionType as AutomationActionType : 'agent_prompt'
}

function parseNotifyOn(value: unknown): 'never' | 'failure' | 'always' {
    const notifyOn = clean(value)
    return NOTIFY_OPTIONS.has(notifyOn) ? notifyOn as 'never' | 'failure' | 'always' : 'failure'
}

function parseTimezone(value: unknown) {
    const timezone = clean(value) || 'UTC'
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
        return timezone
    } catch {
        throw new Error('Timezone must be a valid IANA timezone, for example Europe/Oslo.')
    }
}
