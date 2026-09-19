import { createHash } from 'node:crypto'
import type { AutomationRow } from './automations.ts'
import type { queryOnce } from './db.ts'

export const monitoringScope = (a: AutomationRow) => JSON.stringify([a.owner_id || a.id, a.organization_id || null])
export async function correlationKey(query: typeof queryOnce, a: AutomationRow, fingerprint: string, kind: string, message: string) {
    // A transport refusal identifies a socket, not a URL path. HTTP/application errors retain the full fingerprint.
    const socket = a.target_url?.startsWith('system:cron:') ? null : message.match(/\bconnect (ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH) (\S+:\d+)/)
    let resources: unknown[] = []
    if ((await query('SELECT to_regclass(\'public.monitoring_case_vms\') AS relation')).rows[0]?.relation) {
        resources = (await query('SELECT vm_name FROM monitoring_case_vms WHERE automation_id=$1 AND target_url=$2 ORDER BY vm_name', [a.id, a.target_url])).rows.map(row => row.vm_name)
    }
    const restricted = Boolean(a.target_url?.startsWith('system:cron:')) || ['system:metrics', 'system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment', 'system:resilience'].includes(a.target_url || '') || a.action_type === 'mail_health_check'
        || [a.model_name, ...(a.notification_destinations || [])].some(value => value?.startsWith('discord-webhook-file:'))
    return createHash('sha256').update(JSON.stringify([monitoringScope(a), restricted, resources,
        a.expected_down || false, a.upside_down || false, kind, socket ? [socket[1], socket[2].toLowerCase()] : fingerprint])).digest('hex')
}
