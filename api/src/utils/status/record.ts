import { withTransaction } from '#db'
import { mailConfig } from '#utils/mail/config.ts'
import { addressForUser } from '#utils/mail/helpers.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { notificationEvent, type MonitorStatus } from './monitorPolicy.ts'

export async function recordMonitorResult(
    service: string,
    checkName: string,
    status: MonitorStatus,
    latency: number,
    message = ''
) {
    const event = await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`production-monitor:${service}:${checkName}`])
        const previous = await query(`
            SELECT status
            FROM service_monitor_results
            WHERE service = $1 AND check_name = $2
            ORDER BY checked_at DESC
            LIMIT 3
        `, [service, checkName])
        await query(`
            INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
            VALUES ($1, $2, $3, $4, $5)
        `, [service, checkName, status, latency, message])
        return notificationEvent(status, previous.rows.map((row: { status: MonitorStatus }) => row.status))
    })
    if (!event) return
    const recipient = process.env.MONITOR_ALERT_EMAIL || addressForUser(mailConfig.systemMailboxOwner)
    await sendSystemMail({
        to: recipient,
        subject: `[Hanasand] ${event === 'recovered' ? 'Recovered' : 'Production alert'}: ${checkName}`,
        textBody: [
            `${service} / ${checkName}`,
            event === 'recovered' ? 'The check has recovered.' : `The check is ${status}.`,
            message,
            `Observed at ${new Date().toISOString()}.`,
        ].filter(Boolean).join('\n'),
    }).catch(error => console.error(`[production-monitor] notification failed: ${error instanceof Error ? error.message : String(error)}`))
}
