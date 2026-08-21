import run from '#db'
import { connect } from 'node:tls'
import { deliverDiscordWebhookFile, discordWebhookFileModelLabel, redactSecretBearingText } from '#utils/alerts/discordWebhookFile.ts'
import { getMailHealth } from '#utils/mail/health.ts'

export type AutomationScheduleKind = 'once' | 'interval'
export type AutomationStatus = 'active' | 'paused' | 'archived'
export type AutomationActionType = 'agent_prompt' | 'echo' | 'mail_health_check' | 'system_alert' | 'organization_report'

export type AutomationRow = {
    id: string
    owner_id: string
    name: string
    prompt: string
    target_url: string | null
    timeout_seconds: number
    retry_count: number
    notify_warnings: boolean
    certificate_status: 'valid' | 'expiring' | 'invalid' | 'not_applicable' | null
    certificate_subject: string | null
    certificate_issuer: string | null
    certificate_expires_at: string | null
    schedule_kind: AutomationScheduleKind
    interval_minutes: number | null
    run_at: string | null
    status: AutomationStatus
    action_type: AutomationActionType
    timezone: string
    model_name: string | null
    notify_on: 'never' | 'failure' | 'always'
    organization_id: string | null
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
    warning: boolean
    result: string | null
    error: string | null
    provider: string | null
    model: string | null
    artifacts: unknown
    started_at: string
    completed_at: string | null
    duration_ms: number | null
}

export type AutomationRunArtifact = {
    type: 'log' | 'screenshot' | 'link'
    label: string
    href: string | null
    text: string | null
    createdAt: string
}

export type AutomationInput = {
    name?: unknown
    prompt?: unknown
    targetUrl?: unknown
    target_url?: unknown
    timeoutSeconds?: unknown
    timeout_seconds?: unknown
    retryCount?: unknown
    retry_count?: unknown
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
    notifyWarnings?: unknown
    notify_warnings?: unknown
    organizationId?: unknown
    organization_id?: unknown
}

type NormalizedAutomationInput = {
    name: string
    prompt: string
    targetUrl: string | null
    timeoutSeconds: number
    retryCount: number
    notifyWarnings: boolean
    scheduleKind: AutomationScheduleKind
    intervalMinutes: number | null
    runAt: Date | null
    status: AutomationStatus
    actionType: AutomationActionType
    timezone: string
    modelName: string | null
    notifyOn: 'never' | 'failure' | 'always'
    organizationId: string | null
    nextRunAt: Date | null
}

const ACTIVE_STATUSES = new Set(['active', 'paused', 'archived'])
const ACTION_TYPES = new Set(['agent_prompt', 'echo', 'mail_health_check', 'system_alert', 'organization_report'])
const NOTIFY_OPTIONS = new Set(['never', 'failure', 'always'])
const STALE_RUNNING_AFTER_MS = 2 * 60_000

export function toAutomation(row: AutomationRow) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        prompt: row.prompt,
        targetUrl: row.target_url,
        timeoutSeconds: row.timeout_seconds,
        retryCount: row.retry_count,
        notifyWarnings: row.notify_warnings,
        certificateStatus: row.certificate_status,
        certificateSubject: row.certificate_subject,
        certificateIssuer: row.certificate_issuer,
        certificateExpiresAt: row.certificate_expires_at,
        scheduleKind: row.schedule_kind,
        intervalMinutes: row.interval_minutes,
        runAt: row.run_at,
        status: row.status,
        actionType: row.action_type,
        timezone: row.timezone,
        modelName: row.model_name,
        notifyOn: row.notify_on,
        organizationId: row.organization_id,
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
    const artifacts = normalizeRunArtifacts(row.artifacts)
    return {
        id: row.id,
        automationId: row.automation_id,
        ownerId: row.owner_id,
        status: row.status,
        warning: row.warning,
        result: row.result,
        error: row.error,
        provider: row.provider,
        model: row.model,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationMs: row.duration_ms,
        artifacts,
        logs: artifacts.filter(artifact => artifact.type === 'log').map(artifact => artifact.href || artifact.text || artifact.label),
        screenshots: artifacts.filter(artifact => artifact.type === 'screenshot').map(artifact => artifact.href || artifact.text || artifact.label),
    }
}

export function normalizeAutomationInput(input: AutomationInput, existing?: AutomationRow): NormalizedAutomationInput {
    const name = clean(input.name) || existing?.name || ''
    const prompt = clean(input.prompt) || existing?.prompt || ''
    const targetUrl = normalizeTargetUrl(clean(input.targetUrl ?? input.target_url ?? existing?.target_url))
    const timeoutSeconds = parseBoundedInteger(input.timeoutSeconds ?? input.timeout_seconds ?? existing?.timeout_seconds, 1, 120, 1)
    const retryCount = parseBoundedInteger(input.retryCount ?? input.retry_count ?? existing?.retry_count, 0, 5, 1)
    const notifyWarnings = parseBoolean(input.notifyWarnings ?? input.notify_warnings ?? existing?.notify_warnings, false)
    const scheduleKind = parseScheduleKind(input.scheduleKind ?? input.schedule_kind ?? existing?.schedule_kind)
    const intervalMinutes = parseIntervalMinutes(input.intervalMinutes ?? input.interval_minutes ?? existing?.interval_minutes, scheduleKind)
    const runAt = parseRunAt(input.runAt ?? input.run_at ?? existing?.run_at, scheduleKind)
    const status = parseStatus(input.status ?? existing?.status)
    const actionType = parseActionType(input.actionType ?? input.action_type ?? existing?.action_type)
    const timezone = parseTimezone(input.timezone ?? existing?.timezone)
    const modelName = clean(input.modelName ?? input.model_name ?? existing?.model_name) || null
    const notifyOn = parseNotifyOn(input.notifyOn ?? input.notify_on ?? existing?.notify_on)
    const organizationId = clean(input.organizationId ?? input.organization_id ?? existing?.organization_id) || null
    const nextRunAt = status === 'active' ? computeNextRunAt({ scheduleKind, intervalMinutes, runAt, from: new Date() }) : null

    if (!name) {
        throw new Error('Name is required.')
    }
    if (!prompt) {
        throw new Error('Prompt is required.')
    }

    if (actionType === 'agent_prompt') {
        if (!targetUrl) throw new Error('Monitoring needs a URL to check.')
        let parsedUrl: URL
        try { parsedUrl = new URL(targetUrl) } catch { throw new Error('Monitoring URL must be a valid HTTP or HTTPS URL.') }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Monitoring URL must use HTTP or HTTPS.')
    }

    if (status === 'active' && actionType === 'system_alert' && !modelName) {
        throw new Error('System alerts need a delivery destination before activation.')
    }

    if (status === 'active' && actionType === 'mail_health_check' && notifyOn !== 'never' && !modelName) {
        throw new Error('Mail health alerts need a delivery destination before activation.')
    }

    if (actionType === 'organization_report' && !organizationId) {
        throw new Error('Organization reports need an organization scope.')
    }
    if (status === 'active' && actionType === 'organization_report' && !modelName) {
        throw new Error('Organization reports need a delivery destination before activation.')
    }

    return { name, prompt, targetUrl, timeoutSeconds, retryCount, notifyWarnings, scheduleKind, intervalMinutes, runAt, status, actionType, timezone, modelName, notifyOn, organizationId, nextRunAt }
}

function parseBoundedInteger(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function parseBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback
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

    if (runAt && runAt.getTime() >= from.getTime() - 1000) return runAt
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
               artifacts = $2::jsonb,
               completed_at = NOW(),
               duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INT * 1000
         WHERE status = 'running'
           AND started_at < $1
         RETURNING automation_id
    `, [staleAfter, JSON.stringify(runArtifacts('Automation exceeded the maximum runtime and was recovered by the scheduler.'))])

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
                   duration_ms = $5,
                   warning = $6,
                   artifacts = $7::jsonb
             WHERE id = $1
        `, [runId, result.message, result.provider, result.model, durationMs, 'warning' in result && result.warning === true, JSON.stringify(runArtifacts(result.message, 'artifacts' in result && Array.isArray(result.artifacts) ? result.artifacts : []))])
        await run(`
            UPDATE agent_automations
               SET next_run_at = $2,
                   last_completed_at = NOW(),
                   last_status = 'warning' in result && result.warning === true ? 'warning' : 'completed',
                   last_result = $3,
                   last_error = NULL,
                   consecutive_failures = 0,
                   paused_reason = NULL,
                   run_count = run_count + 1,
                   updated_at = NOW(),
                   certificate_status = $4,
                   certificate_subject = $5,
                   certificate_issuer = $6,
                   certificate_expires_at = $7
             WHERE id = $1
        `, [automation.id, nextRunAt, result.message, 'certificate' in result ? result.certificate.status : automation.certificate_status, 'certificate' in result ? result.certificate.subject : automation.certificate_subject, 'certificate' in result ? result.certificate.issuer : automation.certificate_issuer, 'certificate' in result ? result.certificate.expiresAt : automation.certificate_expires_at])
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
                   duration_ms = $3,
                   artifacts = $4::jsonb
             WHERE id = $1
        `, [runId, message, durationMs, JSON.stringify(runArtifacts(message))])
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
                   certificate_status = COALESCE($4, certificate_status),
                   certificate_subject = COALESCE($5, certificate_subject),
                   certificate_issuer = COALESCE($6, certificate_issuer),
                   certificate_expires_at = COALESCE($7, certificate_expires_at),
                   updated_at = NOW()
             WHERE id = $1
        `, [automation.id, nextRunAt, message, getCertificateFromError(error)?.status || null, getCertificateFromError(error)?.subject || null, getCertificateFromError(error)?.issuer || null, getCertificateFromError(error)?.expiresAt || null])
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

    if (automation.action_type === 'organization_report') {
        const report = await buildOrganizationReport(automation)
        await deliverDiscordIfConfigured(automation, report)
        return {
            provider: 'hanasand-organization-report',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'organization-report',
            message: report,
        }
    }

    return runMonitoringCheck(automation)
}

async function runMonitoringCheck(automation: AutomationRow) {
    if (!automation.target_url) throw new Error('Monitoring is missing the URL to check.')
    const target = new URL(automation.target_url)
    const startedAt = Date.now()
    let certificate: Awaited<ReturnType<typeof checkCertificate>> | { status: 'not_applicable', subject: null, issuer: null, expiresAt: null } | null = target.protocol === 'https:' ? null : { status: 'not_applicable', subject: null, issuer: null, expiresAt: null }
    let lastError: unknown
    for (let attempt = 0; attempt <= automation.retry_count; attempt += 1) {
        try {
            certificate = target.protocol === 'https:' ? await checkCertificate(target, automation.timeout_seconds * 1000) : certificate
            const response = await fetch(target, { signal: AbortSignal.timeout(automation.timeout_seconds * 1000) })
            const message = `Monitoring check ${response.ok ? 'passed' : 'failed'}: ${automation.target_url} returned HTTP ${response.status}.`
            if (!response.ok) throw new Error(message)
            const warning = Date.now() - startedAt >= 1000
            if ((automation.notify_on === 'always' || warning && automation.notify_warnings) && automation.model_name) await deliverDiscordIfConfigured(automation, warning ? `Hanasand monitoring warning: ${message}` : message)
            return { provider: 'hanasand-monitoring', model: 'http', message, certificate: certificate!, warning }
        } catch (error) {
            lastError = error instanceof DOMException && error.name === 'TimeoutError'
                ? new Error(`Monitoring request timed out after ${automation.timeout_seconds} second${automation.timeout_seconds === 1 ? '' : 's'}.`)
                : error
        }
    }
    const message = lastError instanceof Error ? lastError.message : 'Monitoring request failed.'
    if (automation.notify_on !== 'never' && automation.model_name) await deliverDiscordIfConfigured(automation, `Hanasand monitoring alert: ${message}`)
    const failure = Object.assign(new Error(`${message} Failed after ${automation.retry_count + 1} attempt${automation.retry_count ? 's' : ''}.`), { certificate })
    throw failure
}

function checkCertificate(target: URL, timeoutMs: number) {
    return new Promise<{ status: 'valid' | 'expiring' | 'invalid', subject: string | null, issuer: string | null, expiresAt: string | null }>((resolve, reject) => {
        const socket = connect({ host: target.hostname, port: Number(target.port) || 443, servername: target.hostname, rejectUnauthorized: false })
        const finish = (value: { status: 'valid' | 'expiring' | 'invalid', subject: string | null, issuer: string | null, expiresAt: string | null }) => { socket.destroy(); resolve(value) }
        socket.setTimeout(timeoutMs, () => { socket.destroy(); reject(new Error(`Certificate check timed out after ${timeoutMs / 1000} second${timeoutMs === 1000 ? '' : 's'}.`)) })
        socket.once('error', error => { socket.destroy(); reject(new Error(`Certificate check failed: ${error.message}`, { cause: error })) })
        socket.once('secureConnect', () => {
            const certificate = socket.getPeerCertificate()
            const expiresAt = certificate.valid_to ? new Date(certificate.valid_to).toISOString() : null
            const daysRemaining = expiresAt ? (Date.parse(expiresAt) - Date.now()) / 86_400_000 : -1
            finish({ status: daysRemaining < 0 ? 'invalid' : daysRemaining <= 30 ? 'expiring' : 'valid', subject: certificate.subject?.CN || null, issuer: certificate.issuer?.O || certificate.issuer?.CN || null, expiresAt })
        })
    })
}

function getCertificateFromError(error: unknown) {
    return error && typeof error === 'object' && 'certificate' in error ? error.certificate as { status: string, subject: string | null, issuer: string | null, expiresAt: string | null } : null
}

async function deliverDiscordIfConfigured(automation: AutomationRow, content: string) {
    await deliverDiscordWebhookFile(automation.model_name, content)
}

async function buildOrganizationReport(automation: AutomationRow) {
    if (!automation.organization_id) throw new Error('Organization report is missing its organization scope.')
    const watchlists = await run(`
        SELECT value, kind
        FROM organization_watchlist_items
        WHERE organization_id = $1 AND status = 'active' AND archived_at IS NULL
        ORDER BY value ASC
    `, [automation.organization_id])
    const terms = (watchlists.rows as Array<{ value: string, kind: string }>).map(row => `${row.value} (${row.kind})`)
    const snapshot = await fetchOrganizationProduct(automation.organization_id)
    const alerts = Array.isArray(snapshot.alerts) ? snapshot.alerts : []
    const sourceCoverage = snapshot.sourceCoverage && typeof snapshot.sourceCoverage === 'object'
        ? Object.keys(snapshot.sourceCoverage as Record<string, unknown>).length
        : 0
    const readiness = snapshot.readiness && typeof snapshot.readiness === 'object'
        ? String((snapshot.readiness as Record<string, unknown>).decision || 'not reported')
        : 'not reported'
    const lines = [
        `Hanasand monitoring report · ${new Date().toISOString()}`,
        `Organization: ${automation.organization_id}`,
        `Active watchlist: ${terms.length ? terms.join(', ') : 'none configured'}`,
        `Observed alerts: ${alerts.length}`,
        `Source coverage groups: ${sourceCoverage}`,
        `Readiness: ${readiness}`,
    ]
    if (alerts.length) {
        const preview = alerts.slice(0, 5).map((alert: any) => `${alert.severity || 'unknown'} · ${alert.company || alert.matchedTerm?.value || 'match'} · ${alert.reviewState || 'review'}`)
        lines.push(`Alert queue: ${preview.join(' | ')}`)
        if (alerts.length > preview.length) lines.push(`Alert queue: +${alerts.length - preview.length} more; review in DWM.`)
    } else {
        lines.push('Alert queue: no scoped matches in this snapshot.')
    }
    lines.push(`Instructions: ${automation.prompt}`)
    return lines.join('\n')
}

async function fetchOrganizationProduct(organizationId: string) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) throw new Error('Threat-intelligence report runtime is not configured.')
    const url = new URL(`${base}/v1/dwm/product`)
    url.searchParams.set('organizationId', organizationId)
    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
            'x-hanasand-service-token': token,
            'x-organization-id': organizationId,
            'x-tenant-id': organizationId,
        },
        signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload) throw new Error(`Threat-intelligence report returned ${response.status}.`)
    return payload
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeTargetUrl(value: string) {
    return value && !/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? `https://${value}` : value || null
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
    const raw = clean(value)
    if (!raw) return scheduleKind === 'once' ? new Date(Date.now() + 60_000) : null
    const date = new Date(raw)
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

function runArtifacts(message: string, artifacts: unknown[] = []): AutomationRunArtifact[] {
    return normalizeRunArtifacts([
        { type: 'log', label: 'Run log', text: message },
        ...artifacts,
    ])
}

function normalizeRunArtifacts(value: unknown): AutomationRunArtifact[] {
    const items = Array.isArray(value) ? value : []
    return items.flatMap(item => {
        const record = isRecord(item) ? item : { text: String(item || '') }
        const href = firstString(record.href, record.url, record.path, record.screenshotPath)
        const text = firstString(record.text, record.message, record.content)
        const label = firstString(record.label, record.name, record.title) || (href ? href.split('/').pop() || href : text.slice(0, 80)) || 'Artifact'
        const rawType = firstString(record.type, record.kind)
        const type: AutomationRunArtifact['type'] = rawType === 'screenshot' || rawType === 'log' || rawType === 'link'
            ? rawType
            : /screenshot|image|capture/i.test(`${label} ${href}`) ? 'screenshot' : href ? 'link' : 'log'
        if (!href && !text) return []
        return [{
            type,
            label,
            href: href || null,
            text: text || null,
            createdAt: firstString(record.createdAt, record.created_at, record.at) || new Date().toISOString(),
        }]
    }).slice(0, 20)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values: unknown[]) {
    return values.find(value => typeof value === 'string' && value.trim()) as string | undefined || ''
}
