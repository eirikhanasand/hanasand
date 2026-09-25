import { createHash } from 'node:crypto'
import type { AutomationRow } from './automations.ts'
import type { queryOnce } from './db.ts'

export const monitoringScope = (a: AutomationRow) => JSON.stringify([a.owner_id || a.id, a.organization_id || null])
export const isIntelHealthCheck = (a: Pick<AutomationRow, 'target_url'>) => ['system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment'].includes(a.target_url || '')
export function monitoringTransportTarget(a: Pick<AutomationRow, 'target_url' | 'monitoring_type'>, message: string) {
    if (!a.target_url || a.target_url.startsWith('system:') || !/(?:TLS certificate validation failed|Certificate check failed|Connection failed|Connection refused|connect (?:ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH)|timed out|timeout exceeded|Unable to connect)/i.test(message)) return null
    try {
        const target = new URL(['tcp', 'ssh'].includes(a.monitoring_type) ? `tcp://${a.target_url}` : a.target_url)
        // Status URLs identify distinct synthetic checks, not the destination
        // that failed inside the check (search, backup, collection, etc.).
        if (['hanasand.com', 'api.hanasand.com'].includes(target.hostname) && target.pathname === '/api/status') return null
        const port = target.port || (target.protocol === 'https:' ? '443' : a.monitoring_type === 'ssh' ? '22' : '80')
        // Prefer the configured hostname over a transient DNS answer. Distinct
        // hostnames on shared hosting do not necessarily have the same failure.
        const socket = message.match(/\bconnect (?:ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH) ([^\s:]+):(\d+)/)
        return [target.hostname.toLowerCase(), socket?.[1].toLowerCase() === target.hostname.toLowerCase() ? socket[2] : port]
    } catch { return null }
}
export async function correlationKey(query: typeof queryOnce, a: AutomationRow, fingerprint: string, kind: string, message: string) {
    // TLS, refusal and timeout are changing evidence for one endpoint outage.
    const endpoint = monitoringTransportTarget(a, message)
    let resources: unknown[] = []
    if ((await query('SELECT to_regclass(\'public.monitoring_case_vms\') AS relation')).rows[0]?.relation) {
        resources = (await query('SELECT vm_name FROM monitoring_case_vms WHERE automation_id=$1 AND target_url=$2 ORDER BY vm_name', [a.id, a.target_url])).rows.map(row => row.vm_name)
    }
    const restricted = Boolean(a.target_url?.startsWith('system:cron:')) || ['system:metrics', 'system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment', 'system:recovery'].includes(a.target_url || '') || a.action_type === 'mail_health_check'
        || [a.model_name, ...(a.notification_destinations || [])].some(value => value?.startsWith('discord-webhook-file:'))
    return createHash('sha256').update(JSON.stringify([monitoringScope(a), restricted, resources,
        a.expected_down || false, a.upside_down || false, kind, endpoint || fingerprint])).digest('hex')
}
