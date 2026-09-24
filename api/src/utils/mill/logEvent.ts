import { classifyApplicationError } from './applicationError.ts'
import { mongoCommandFromLog } from './analyzeMongo.ts'
export type LogInput = { id: string | number, service: string, host?: string, level: string, message: string, created_at: string | Date, metadata?: Record<string, unknown>, source_event_id?: string }
export const severityOrder = ['low', 'medium', 'high', 'critical'] as const
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export function normalizeLogEvent(log: LogInput, rules?: Parameters<typeof classifyApplicationError>[1]) {
    const classification = classifyApplicationError(log, rules)
    if (classification) log = { ...log, level: classification.level, metadata: classification.metadata }
    const mongo = mongoCommandFromLog(log)
    const metadata = object(log.metadata)
    const structured = object(metadata.structured)
    const request = object(structured.req || metadata.request)
    const response = object(structured.res)
    const access = object(structured.access)
    const process = Object.keys(object(metadata.process || structured.process)).length ? object(metadata.process || structured.process) : undefined
    const signin = /(?:Accepted|Failed) (?:password|publickey) for (?:invalid user )?(\S+) from (\S+)/.exec(log.message)
    const authentication = Boolean(signin) || /(?:^|[-_])(ssh|sshd|auth|sudo)(?:[-_]|$)/i.test(log.service) || metadata.category === 'authentication' || metadata.event_type === 'authentication'
    const path = metadata.path || metadata.url || request.url || request.path || access.path
    const statusCode = metadata.status_code || metadata.statusCode || response.statusCode || access.status
    const inferredType = process ? 'ProcessLogs' : authentication ? 'SigninLogs' : metadata.category === 'http_response_error' || path ? 'HttpLogs' : /^(system|kernel|systemd|audit)$/.test(log.service) ? 'SystemLogs' : 'ApplicationLogs'
    const type = ['SigninLogs', 'ApplicationLogs', 'ProcessLogs', 'HttpLogs', 'SystemLogs'].includes(String(metadata.log_type)) ? String(metadata.log_type) : inferredType
    const user = object(metadata.user || structured.user)
    const source = object(metadata.source || structured.source)
    return {
        ...(['routine-group-analyzer', 'postgres-session-analyzer'].includes(log.service) && log.source_event_id ? { source_event_id: log.source_event_id } : {}),
        schema_version: 'logs.v1', timestamp: new Date(log.created_at).toISOString(),
        event_type: mongo ? 'database' : process ? 'process' : authentication ? 'authentication' : String(metadata.event_type || structured.event_type || 'application'),
        action: mongo ? mongo.name : process ? 'exec' : String(metadata.action || structured.action || (signin ? 'login' : 'log')),
        outcome: mongo ? mongo.success ? 'success' : 'failure' : String(metadata.outcome || structured.outcome || (signin ? log.message.includes('Accepted ') ? 'success' : 'failure' : ['error', 'fatal'].includes(log.level) ? 'failure' : 'unknown')),
        log_type: type, level: log.level, service: log.service, host: log.host || '', message: log.message,
        mongo: mongo ? { command: mongo.name, database: mongo.database, arguments: mongo.command, connection: mongo.connection, clientIp: mongo.ip } : undefined,
        process, http: path ? { path, method: metadata.method || request.method || access.method, status_code: statusCode } : undefined,
        user: signin ? { ...user, id: `${log.host || 'unknown'}:${signin[1]}`, name: signin[1] } : user,
        source: { ...source, ip: mongo?.ip || signin?.[2] || source.ip || request.remoteAddress || metadata.source_ip || access.ip },
        device: metadata.device || structured.device, metadata,
        severity: classification?.severity || (log.level === 'fatal' ? 'critical' : log.level === 'error' ? 'high' : log.level === 'warn' ? 'medium' : 'low'),
    }
}
