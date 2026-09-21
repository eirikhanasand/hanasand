import ipaddr from 'ipaddr.js'

// Keep the stored ID so rule history and the user's Keep/Disable choice survive.
export const mongoRuleId = 'mongodb.cashflow_connections.v1'
export const mongoRule = {
    id: mongoRuleId, version: '1', name: 'Cashflow MongoDB successful pings', family: 'Database', severity: 'low', enabled: false,
    explanation: 'Count completed, successful ping-only commands from inspur/cashflow mongodb by client and database, then drop those command records. Keep connection metadata, other commands, failures and incomplete records.',
    evidence: ['command', 'result', 'client IP', 'database', 'command count'],
}
export const mongoDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
export const mongoReconRule = {
    id: 'database.mongodb_enumeration.v1', version: '1', name: 'MongoDB enumeration', family: 'Database', severity: 'high', source: 'owned',
    explanation: 'MongoDB executed or attempted database, collection, user or role enumeration. Review the command and connection context.',
}
export const mongoReconDefinition = { match: 'all', conditions: [
    { path: 'event_type', operator: 'equals', value: 'database' },
    { path: 'action', operator: 'regex', value: '^(listDatabases|listCollections|usersInfo|rolesInfo)$' },
] }
export type MongoLog = { host?: string, service: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
function hasFailure(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    return Object.entries(value).some(([key, item]) => /^(?:err|error|errmsg|errName|errCode|exception|failure|failed|errorCode)$/i.test(key)
        || (/^(?:ok|success)$/i.test(key) && (item === false || item === 0))
        || (/^(?:status|outcome)$/i.test(key) && /fail|error|timeout|denied/i.test(String(item))) || hasFailure(item))
}

// MongoDB 7's completed-operation record includes ok:0 / errCode on failure.
// A connection, client name or command-start record never proves success.
export function mongoCommandFromLog(log: MongoLog) {
    if (log.host !== 'inspur/cashflow' || log.service !== 'mongodb' || log.metadata?.organizationId || log.metadata?.tenantId) return null
    try {
        const event = JSON.parse(log.message), attr = object(event?.attr), command = object(attr.command)
        if (event?.c !== 'COMMAND' || event.id !== 51803 || event.msg !== 'Slow query' || attr.type !== 'command' || !Object.keys(command).length) return null
        const name = Object.keys(command)[0], database = typeof command.$db === 'string' ? command.$db : ''
        const remote = typeof attr.remote === 'string' ? attr.remote : ''
        const address = /^\[([^\]]+)\]:\d+$/.exec(remote)?.[1] || /^([^:]+):\d+$/.exec(remote)?.[1] || ''
        const ip = ipaddr.isValid(address) ? ipaddr.process(address).toString() : ''
        return { event, attr, command, name, database, ip, connection: String(event.ctx || ''),
            success: event.s === 'I' && !hasFailure(event) && !hasFailure(log.metadata) }
    } catch { return null }
}
export function eligibleMongoPing(log: MongoLog) {
    const inspected = mongoCommandFromLog(log)
    if (!inspected || !log.sourceEventId || log.level !== 'info' || !inspected.success) return null
    const { command, attr, event, name, database, ip } = inspected
    if (name !== 'ping' || command.ping !== 1 || !database || !ip || !/^conn\d+$/.test(inspected.connection)
        || typeof attr.durationMillis !== 'number' || attr.durationMillis < 0 || !Number.isFinite(attr.durationMillis)
        || typeof attr.reslen !== 'number' || attr.reslen <= 0 || typeof event.t?.$date !== 'string' || !Number.isFinite(Date.parse(event.t.$date))) return null
    if (Object.keys(command).some(key => !['ping', '$db', 'lsid', 'comment'].includes(key))) return null
    if (command.comment !== undefined && (typeof command.comment !== 'string' || !/^[\w .:-]{0,128}$/.test(command.comment))) return null
    if (command.lsid !== undefined) {
        const session = object(command.lsid), id = object(session.id)
        if (Object.keys(session).join() !== 'id' || Object.keys(id).join() !== '$uuid' || typeof id.$uuid !== 'string'
            || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id.$uuid)) return null
    }
    if (event.truncated || attr.truncated || attr.ok !== undefined && attr.ok !== 1) return null
    return { database, ip, timestamp: event.t.$date as string }
}
