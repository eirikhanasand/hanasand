export type MillCondition = { path: string, operator: 'equals' | 'contains' | 'regex', value: string }
export function matchesMillRule(event: Record<string, unknown>, conditions: MillCondition[]) {
    return conditions.every(condition => {
        const value = getMillPath(event, condition.path)
        if (value === undefined || value === null || typeof value === 'object') return false
        const actual = String(value)
        if (condition.operator === 'equals') return actual.toLowerCase() === condition.value.toLowerCase()
        if (condition.operator === 'contains') return actual.toLowerCase().includes(condition.value.toLowerCase())
        try { return new RegExp(condition.value, 'i').test(actual) } catch { return false }
    })
}
function getMillPath(value: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>)[part] : undefined, value)
}
