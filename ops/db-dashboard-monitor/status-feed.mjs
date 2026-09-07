import { spawn } from 'node:child_process'
const MAX_AGE_MS = 5 * 60_000
const required = ['API Health', 'Public Website', 'Public Search', 'Processing Backlog', 'Source Collection', 'Browser Workspace', 'Monitoring Workspace', 'Latest Activity']

export function evaluateStatusFeed(payload, now = Date.now()) {
    if (!payload || !Array.isArray(payload.checks) || payload.checks.length === 0) return 'The public status feed has no monitored checks.'
    if (payload.monitoring !== 'live') return 'The public status feed reports monitoring unavailable.'
    for (const name of required) {
        const check = payload.checks.find(row => row?.check_name === name)
        const at = Date.parse(check?.checked_at || '')
        if (!check || !['up', 'degraded', 'down'].includes(check.status) || !Number.isFinite(at) || now - at > MAX_AGE_MS || at - now > 60_000) return `The public status check ${name} is missing or stale.`
    }
    const verified = Date.parse(payload.last_verified_at || '')
    if (!Number.isFinite(verified) || now - verified > MAX_AGE_MS || verified - now > 60_000) return 'The public status feed has no recent verified snapshot.'
    const history = Date.parse(payload.history_generated_at || '')
    if (!payload.history_available || !Number.isFinite(history) || now - history > 15 * 60_000) return 'The status history refresh is unavailable or more than 15 minutes old.'
    return null
}

export async function checkStatusFeed(url, fetcher = fetch) {
    const started = performance.now()
    try {
        const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Status feed returned HTTP ${response.status}.`)
        const reason = evaluateStatusFeed(await response.json())
        if (reason) throw new Error(reason)
        return { ok: true, reason: 'status_feed_ok', detail: 'Public status checks and history are reporting.', latencyMs: Math.round(performance.now() - started), metrics: {} }
    } catch (error) {
        return { ok: false, reason: 'status_feed_unavailable', detail: error.message || 'The public status feed could not be read.', latencyMs: Math.round(performance.now() - started), metrics: {} }
    }
}

// Use the existing mail worker's SMTP identity, independently of the public API
// and its database connection. Credentials never leave that container.
export async function sendStatusFeedEmail(subject, textBody) {
    const code = `import { sendSystemMail } from './src/utils/mail/system.ts';
import { mailConfig } from './src/utils/mail/config.ts';
import { addressForUser } from './src/utils/mail/helpers.ts';
const message = await Bun.stdin.json();
await sendSystemMail({ to: process.env.MONITOR_ALERT_EMAIL || addressForUser(mailConfig.systemMailboxOwner), ...message });`
    await new Promise((resolve, reject) => {
        const child = spawn('docker', ['exec', '-i', '-w', '/app', process.env.HANASAND_STATUS_MAIL_CONTAINER || 'hanasand_api', 'bun', '-e', code], { stdio: ['pipe', 'ignore', 'pipe'] })
        let error = ''
        child.stderr.on('data', chunk => { error = (error + chunk).slice(-500) })
        const timer = setTimeout(() => { child.kill(); reject(new Error('Status monitoring email timed out.')) }, 30_000)
        child.on('error', failure => { clearTimeout(timer); reject(failure) })
        child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Status monitoring email failed (${code}): ${error}`)) })
        child.stdin.on('error', () => {})
        child.stdin.end(JSON.stringify({ subject, textBody }))
    })
}
