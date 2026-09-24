import type { MillCondition } from './conditions.ts'

function regexCandidate(expression: string): string | null {
    const token = /(?:[A-Za-z0-9 _:/@,=-]|[.^$*+?()|]|\{\d+(?:,\d*)?\}|\[\^?[A-Za-z0-9 _:/@,=.-]+\]|\\[dDwWsSbB]|\\[.^$*+?()|{}[\]\\])/gy
    let offset = 0, pattern = ''
    if (expression.includes('(?')) return null
    while (offset < expression.length) {
        token.lastIndex = offset
        const match = token.exec(expression)
        if (!match) return null
        const part = match[0]
        // PostgreSQL bounds repetition counts at 255; JavaScript does not.
        if (part.startsWith('{') && part.match(/\d+/g)!.some(count => Number(count) > 255)) return null
        pattern += ({ '\\d': '[0-9]', '\\D': '[^0-9]', '\\w': '[A-Za-z0-9_]', '\\W': '[^A-Za-z0-9_]', '\\s': '[[:space:]]', '\\S': '[^[:space:]]', '\\b': '\\y', '\\B': '\\Y', '$': '' } as Record<string, string>)[part] ?? part
        offset = token.lastIndex
    }
    return pattern
}

// These are candidate predicates, not a second rule engine. Keep the runtime
// recheck: JavaScript number formatting and Unicode folding differ from SQL.
export function previewPredicate(conditions: MillCondition[], params: (string | boolean | null | string[])[]) {
    const bind = (value: string | string[]) => { params.push(value); return `$${params.length}` }
    const predicates: string[] = []
    for (const condition of conditions) {
        const parts = condition.path.split('.')
        const path = bind(parts), json = `(normalized #> ${path}::text[])`, text = `(normalized #>> ${path}::text[])`
        predicates.push(`jsonb_typeof(${json}) IN ('string', 'number', 'boolean')`)
        // Array subscripts accepted by #> are not paths accepted by getMillPath.
        for (let depth = 1; depth < parts.length; depth++) predicates.push(`jsonb_typeof(normalized #> ${bind(parts.slice(0, depth))}::text[]) = 'object'`)
        const ascii = `${text} !~ '[^\\x00-\\x7F]'`
        const unusualNumber = `(jsonb_typeof(${json}) = 'number' AND ${text} !~ '^(0|-?[1-9][0-9]{0,14})$')`
        if (condition.operator === 'equals') {
            const value = bind(condition.value.toLowerCase())
            const number = Number(condition.value)
            const numeric = Number.isFinite(number) && String(number).toLowerCase() === condition.value.toLowerCase()
                ? `${text}::numeric BETWEEN ${bind(String(number))}::numeric - ${bind(String(Math.max(Math.abs(number) * Number.EPSILON, Number.MIN_VALUE)))}::numeric
                    AND ${bind(String(number))}::numeric + ${bind(String(Math.max(Math.abs(number) * Number.EPSILON, Number.MIN_VALUE)))}::numeric` : 'FALSE'
            predicates.push(`CASE WHEN jsonb_typeof(${json}) = 'number' THEN ${numeric}
                WHEN ${ascii} THEN lower(${text} COLLATE "C") = ${value} ELSE TRUE END`)
        } else if (condition.operator === 'contains') {
            const value = bind(condition.value.toLowerCase())
            predicates.push(`CASE WHEN ${unusualNumber} OR NOT (${ascii}) THEN TRUE
                ELSE strpos(lower(${text} COLLATE "C"), ${value}) > 0 END`)
        } else {
            // A deliberately restricted common subset. Backreferences, lookarounds,
            // Unicode and JS escapes stay in the bounded worker, never translated
            // to a different regex dialect. Other conditions still narrow them.
            const expression = regexCandidate(condition.value)
            if (expression !== null) {
                const pattern = bind(expression)
                predicates.push(`CASE WHEN ${unusualNumber} OR NOT (${ascii}) THEN TRUE
                    ELSE ${text} COLLATE "C" ~* ${pattern} END`)
            }
        }
    }
    return predicates.length ? predicates.join(' AND ') : 'TRUE'
}
