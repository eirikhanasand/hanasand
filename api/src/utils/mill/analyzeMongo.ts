export const mongoRuleId = 'mongodb.cashflow_connections.v1'
export const mongoRule = {
    id: mongoRuleId, version: '1', name: 'Cashflow MongoDB routine connections', family: 'Database', severity: 'low', enabled: false,
    explanation: 'Drop informational loopback connection open/close messages and local mongosh client metadata from inspur/cashflow mongodb. Keep warnings, errors, authentication events, command logs and unknown messages.',
    evidence: ['host', 'service', 'MongoDB message ID', 'loopback address'],
}
export const mongoDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }

export type MongoLog = { host: string, service: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string }

function hasFailure(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    return Object.entries(value).some(([key, item]) => /^(?:err|error|errmsg|exception|failure|failed|errorCode)$/i.test(key)
        || (/^(?:ok|success)$/i.test(key) && (item === false || item === 0))
        || (/^(?:status|outcome)$/i.test(key) && /fail|error|timeout|denied/i.test(String(item)))
        || hasFailure(item))
}

export function eligibleMongoConnection(log: MongoLog): boolean {
    if (log.host !== 'inspur/cashflow' || log.service !== 'mongodb' || log.level !== 'info' || !log.sourceEventId
        || log.metadata?.organizationId || log.metadata?.tenantId) return false
    try {
        const event = JSON.parse(log.message)
        if (hasFailure(event) || hasFailure(log.metadata)) return false
        if (!event || event.s !== 'I' || event.c !== 'NETWORK' || !event.attr || Array.isArray(event.attr)) return false
        // Unknown attributes are retained, including error/status fields even if
        // a collector or MongoDB version labels a failed event informational.
        const allowed = event.id === 22943 || event.id === 22944 ? ['remote', 'isLoadBalanced', 'uuid', 'connectionId', 'connectionCount']
            : event.id === 51800 ? ['remote', 'client', 'negotiatedCompressors', 'doc'] : []
        if (!allowed.length || Object.keys(event.attr).some(key => !allowed.includes(key))
            || Object.keys(event).some(key => !['t', 's', 'c', 'id', 'ctx', 'msg', 'attr'].includes(key))) return false
        if (typeof event.attr.remote !== 'string' || !/^(?:127\.0\.0\.1|\[::1\]):[0-9]{1,5}$/.test(event.attr.remote)) return false
        if (event.id === 22943) return event.msg === 'Connection accepted'
        if (event.id === 22944) return event.msg === 'Connection ended'
        return event.msg === 'client metadata' && /^mongosh \d+\.\d+\.\d+$/.test(event.attr.doc?.application?.name || '')
            && event.attr.doc?.driver?.name === 'nodejs|mongosh'
    } catch {
        return false
    }
}
