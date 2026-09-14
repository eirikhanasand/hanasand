import type { RuntimeLog, ServiceLog } from './getLogs'

export function logKey(log: RuntimeLog | ServiceLog): string {
    // Runtime IDs include only a message prefix; retain distinct full messages.
    return JSON.stringify([log.id, log.message])
}

export function mergeRuntimeLogs(previous: RuntimeLog[], incoming: RuntimeLog[]): RuntimeLog[] {
    const seen = new Set(previous.map(logKey))
    const additions = incoming.filter(log => {
        const key = logKey(log)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
    // Keep existing rows in place, even if a later poll no longer includes them.
    return additions.length ? [...additions, ...previous] : previous
}
