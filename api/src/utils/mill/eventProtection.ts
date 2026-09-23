type Scalar = string | number | boolean | null
type Context = { path: string, operator: 'signal' | 'equals' | 'truthy', value?: Scalar }
type Check = { keys: string[], operator: 'signal' | 'in' | 'numberAtLeast' | 'equals' | 'objectMismatch', values?: Scalar[], value?: Scalar, expected?: Record<string, Scalar>, whenAny?: Context[] }
export type EventProtectionPolicy = { checks: Check[] }
export const eventProtectionRuleId = 'security.event_evidence.v1'
export const eventProtectionRule = { id: eventProtectionRuleId, version: '1', name: 'Store security and failure evidence', family: 'Security', severity: 'low', enabled: true,
    explanation: 'Store events with security findings, failure evidence, elevated severity or unsafe HTTP content. These storage exceptions take precedence over Drop rules.', evidence: ['matched evidence fields'] }
const http: Context[] = [{ path: 'http', operator: 'truthy' }, { path: 'log_type', operator: 'equals', value: 'HttpLogs' }, { path: 'event_type', operator: 'equals', value: 'http' }]
export const eventProtectionDefinition = { match: 'all' as const, stage: 'analyze' as const, action: 'keep' as const, conditions: [], protection: { checks: [
    { keys: ['detections', 'signature', 'signature_id', 'error', 'errors', 'exception', 'failure', 'failed', 'err', 'errmsg', 'errCode', 'errName', 'errorCode', 'protected', 'suspicious'], operator: 'signal' },
    { keys: ['severity', 'level'], operator: 'in', values: ['medium', 'high', 'critical', 'warn', 'warning', 'error', 'fatal'] },
    { keys: ['level'], operator: 'numberAtLeast', value: 40 },
    { keys: ['outcome', 'status'], operator: 'in', values: ['failure', 'failed', 'error', 'denied', 'blocked', 'timeout', 'timed_out'] },
    { keys: ['success', 'ok'], operator: 'in', values: [false, 0] },
    { keys: ['status', 'status_code', 'statusCode'], operator: 'numberAtLeast', value: 400 },
    { keys: ['bodyEmpty', 'headersSafe', 'pathSafe'], operator: 'equals', value: false },
    { keys: ['body', 'request_body'], operator: 'signal', whenAny: http },
    { keys: ['inspection'], operator: 'objectMismatch', expected: { version: 1, bodyEmpty: true, headersSafe: true, pathSafe: true }, whenAny: http },
] } satisfies EventProtectionPolicy }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const scalar = (value: unknown): value is Scalar => value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value)
const signal = (value: unknown): boolean => value !== null && value !== undefined && value !== false && value !== 0
    && (typeof value === 'string' ? value.trim().length > 0 : typeof value === 'object' ? Object.keys(value).length > 0 : true)
const equal = (left: unknown, right: unknown) => typeof left === 'string' && typeof right === 'string' ? left.toLowerCase() === right.toLowerCase() : left === right

export function normalizeEventProtection(value: unknown): { protection?: EventProtectionPolicy, error?: string } {
    const error = 'Protection must contain valid checks with field keys and matching operators.'
    if (!record(value) || Object.keys(value).some(key => key !== 'checks') || !Array.isArray(value.checks) || value.checks.length > 32) return { error }
    for (const check of value.checks) {
        if (!record(check) || Object.keys(check).some(key => !['keys', 'operator', 'values', 'value', 'expected', 'whenAny'].includes(key))
            || !Array.isArray(check.keys) || !check.keys.length || check.keys.length > 128 || check.keys.some(key => typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(key))) return { error }
        if (!['signal', 'in', 'numberAtLeast', 'equals', 'objectMismatch'].includes(String(check.operator))) return { error }
        if (check.operator === 'in' && (!Array.isArray(check.values) || check.values.length > 128 || !check.values.every(scalar))) return { error }
        if (check.operator === 'equals' && !scalar(check.value)) return { error }
        if (check.operator === 'numberAtLeast' && (typeof check.value !== 'number' || !Number.isFinite(check.value))) return { error }
        if (check.operator === 'objectMismatch' && (!record(check.expected) || !Object.keys(check.expected).length || Object.keys(check.expected).length > 32 || !Object.values(check.expected).every(scalar))) return { error }
        if (check.whenAny !== undefined && (!Array.isArray(check.whenAny) || !check.whenAny.length || check.whenAny.length > 16 || check.whenAny.some(context => !record(context)
            || Object.keys(context).some(key => !['path', 'operator', 'value'].includes(key)) || typeof context.path !== 'string' || !/^[a-zA-Z0-9_.-]{1,200}$/.test(context.path)
            || !['signal', 'equals', 'truthy'].includes(String(context.operator)) || context.operator === 'equals' && !scalar(context.value)))) return { error }
    }
    return { protection: structuredClone(value) as EventProtectionPolicy }
}

// The policy determines what to retain. Bounds only fail closed when complete
// evaluation is impossible; they never establish that an event may be dropped.
export function matchesEventProtection(event: Record<string, unknown>, policy: EventProtectionPolicy): boolean {
    const checks = policy.checks.filter(check => !check.whenAny || check.whenAny.some(context => {
        const value = context.path.split('.').reduce<unknown>((row, key) => record(row) ? row[key] : undefined, event)
        return context.operator === 'signal' ? signal(value) : context.operator === 'truthy' ? Boolean(value) : equal(value, context.value)
    }))
    const pending: unknown[] = [event], seen = new Set<object>()
    while (pending.length) {
        const row = pending.pop()
        if (!row || typeof row !== 'object' || seen.has(row)) continue
        if (seen.size >= 256) return true
        seen.add(row)
        for (const [key, value] of Object.entries(row)) {
            for (const check of checks) {
                if (!check.keys.includes(key)) continue
                if (check.operator === 'signal' && signal(value)
                    || check.operator === 'in' && check.values!.some(expected => equal(value, expected))
                    || check.operator === 'equals' && equal(value, check.value)
                    || check.operator === 'numberAtLeast' && typeof value === 'number' && value >= Number(check.value)
                    || check.operator === 'objectMismatch' && (!record(value) || Object.entries(check.expected!).some(([field, expected]) => value[field] !== expected))) return true
            }
            if (value && typeof value === 'object') pending.push(value)
        }
    }
    return false
}
