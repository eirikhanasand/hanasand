export type Condition = { path: string, operator: 'equals' | 'contains' | 'regex', value: string, caseSensitive?: boolean }
export function matchesRule(event: Record<string, unknown>, conditions: Condition[]) {
    return conditions.every(condition => {
        const value = getPath(event, condition.path)
        if (value === undefined || value === null || typeof value === 'object') return false
        const actual = String(value)
        const comparable = condition.caseSensitive ? actual : actual.toLowerCase()
        const expected = condition.caseSensitive ? condition.value : condition.value.toLowerCase()
        if (condition.operator === 'equals') return comparable === expected
        if (condition.operator === 'contains') return comparable.includes(expected)
        try { return new RegExp(condition.value, condition.caseSensitive ? '' : 'i').test(actual) } catch { return false }
    })
}
function getPath(value: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>)[part] : undefined, value)
}
