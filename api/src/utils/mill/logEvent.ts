export type LogInput = { id: string | number, service: string, host?: string, level: string, message: string, created_at: string | Date, metadata?: Record<string, unknown> }
export const severityOrder = ['low', 'medium', 'high', 'critical'] as const
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export function normalizeLogEvent(log: LogInput) {
    const metadata = object(log.metadata)
    const structured = object(metadata.structured)
    const request = object(structured.req || metadata.request)
    const response = object(structured.res)
    const process = Object.keys(object(metadata.process || structured.process)).length ? object(metadata.process || structured.process) : undefined
    const signin = /(?:Accepted|Failed) (?:password|publickey) for (?:invalid user )?(\S+) from (\S+)/.exec(log.message)
    const authentication = Boolean(signin) || /(?:^|[-_])(ssh|sshd|auth|sudo)(?:[-_]|$)/i.test(log.service) || metadata.category === 'authentication' || metadata.event_type === 'authentication'
    const path = metadata.path || metadata.url || request.url || request.path
    const statusCode = metadata.status_code || metadata.statusCode || response.statusCode
    const inferredType = process ? 'ProcessLogs' : authentication ? 'SigninLogs' : metadata.category === 'http_response_error' || path ? 'HttpLogs' : /^(system|kernel|systemd|audit)$/.test(log.service) ? 'SystemLogs' : 'ApplicationLogs'
    const type = ['SigninLogs', 'ApplicationLogs', 'ProcessLogs', 'HttpLogs', 'SystemLogs'].includes(String(metadata.log_type)) ? String(metadata.log_type) : inferredType
    const user = object(metadata.user || structured.user)
    const source = object(metadata.source || structured.source)
    return {
        schema_version: 'logs.v1', timestamp: new Date(log.created_at).toISOString(),
        event_type: process ? 'process' : authentication ? 'authentication' : String(metadata.event_type || structured.event_type || 'application'),
        action: process ? 'exec' : String(metadata.action || structured.action || (signin ? 'login' : 'log')),
        outcome: String(metadata.outcome || structured.outcome || (signin ? log.message.includes('Accepted ') ? 'success' : 'failure' : ['error', 'fatal'].includes(log.level) ? 'failure' : 'unknown')),
        log_type: type, level: log.level, service: log.service, host: log.host || '', message: log.message,
        process, http: path ? { path, method: metadata.method || request.method, status_code: statusCode } : undefined,
        user: signin ? { ...user, id: `${log.host || 'unknown'}:${signin[1]}`, name: signin[1] } : user,
        source: { ...source, ip: signin?.[2] || source.ip || request.remoteAddress || metadata.source_ip },
        device: metadata.device || structured.device, metadata,
        severity: log.level === 'fatal' ? 'critical' : log.level === 'error' ? 'high' : log.level === 'warn' ? 'medium' : 'low',
    }
}
