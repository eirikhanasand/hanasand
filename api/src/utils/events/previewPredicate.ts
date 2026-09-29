import type { Condition } from './conditions.ts'

// Expand only anchored finite regexes made from literal characters, alternation,
// groups, and small character classes. Anything else stays with the JS matcher.
export function finiteRegexAlternatives(expression: string, limit = 64): string[] | null {
    if (!expression.startsWith('^') || !expression.endsWith('$')) return null
    const source = expression.slice(1, -1)
    let offset = 0
    const combine = (left: string[], right: string[]): string[] | null => left.length * right.length > limit
        ? null : left.flatMap(prefix => right.map(suffix => prefix + suffix))
    const parseClass = (): string[] | null => {
        const end = source.indexOf(']', offset + 1)
        if (end < 0) return null
        const contents = source.slice(offset + 1, end)
        if (!contents || contents.startsWith('^')) return null
        let values: string[]
        const range = /^([A-Za-z0-9])-([A-Za-z0-9])$/.exec(contents)
        if (range) {
            const [, first, last] = range
            if (first.charCodeAt(0) > last.charCodeAt(0)) return null
            values = Array.from({ length: last.charCodeAt(0) - first.charCodeAt(0) + 1 }, (_, index) => String.fromCharCode(first.charCodeAt(0) + index))
        } else {
            if (!/^[A-Za-z0-9_-]+$/.test(contents) || (contents.includes('-') && !contents.startsWith('-') && !contents.endsWith('-'))) return null
            values = [...contents]
        }
        if (values.some(value => !/[A-Za-z0-9_-]/.test(value))) return null
        if (values.length > limit) return null
        offset = end + 1
        return values
    }
    const parsePiece = (): string[] | null => {
        const char = source[offset]
        if (char === '(') {
            offset++
            if (source.slice(offset, offset + 2) === '?:') offset += 2
            const values = parseAlternatives(true)
            if (!values || source[offset] !== ')') return null
            offset++
            return values
        }
        if (char === '[') return parseClass()
        if (char === '\\') {
            const escaped = source[offset + 1]
            if (!escaped || !'.[]{}()*+?^$|\\-'.includes(escaped)) return null
            offset += 2
            return [escaped]
        }
        if (!/[A-Za-z0-9_-]/.test(char || '')) return null
        offset++
        return [char]
    }
    const parseSequence = (): string[] | null => {
        let sequence = ['']
        while (offset < source.length) {
            const char = source[offset]
            if (char === '|' || char === ')') break
            const piece = parsePiece()
            if (!piece) return null
            const combined = combine(sequence, piece)
            if (!combined) return null
            sequence = combined
        }
        return sequence
    }
    const parseAlternatives = (insideGroup = false): string[] | null => {
        const alternatives: string[] = []
        let sequence = parseSequence()
        if (!sequence) return null
        alternatives.push(...sequence)
        while (source[offset] === '|') {
            offset++
            sequence = parseSequence()
            if (!sequence) return null
            alternatives.push(...sequence)
            if (alternatives.length > limit) return null
        }
        if (insideGroup && source[offset] !== ')') return null
        return alternatives
    }
    const values = parseAlternatives()
    if (!values || offset !== source.length || values.length > limit) return null
    return [...new Set(values)]
}

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

const scalarColumns: Record<string, string> = {
    service: 'normalized->>\'service\'',
    event_type: 'event_type',
    action: 'action',
    outcome: 'outcome',
    'user.id': 'user_id',
    'user.email': 'user_email',
    'source.ip': 'source_ip',
    'source.country': 'source_country',
    'source.city': 'source_city',
    'device.id': 'device_id',
}

function scalarCandidatePredicate(condition: Condition, column: string, bind: (value: string) => string) {
    // Normalized log service has a matching partial B-tree index. The JSON path
    // scalar check already excludes missing/null values, so keep this term
    // sargable for exact service rules instead of wrapping it in a fallback OR.
    if (column === 'normalized->>\'service\'' && condition.operator === 'equals' && condition.caseSensitive)
        return `${column} = ${bind(condition.value)}`
    const ascii = `${column} !~ '[^\\x00-\\x7F]'`
    const prefix = `${column} IS NULL OR NOT (${ascii}) OR `
    const actual = condition.caseSensitive ? column : `lower(${column} COLLATE "C")`
    const expected = bind(condition.caseSensitive ? condition.value : condition.value.toLowerCase())
    if (condition.operator === 'equals') return `(${prefix}${actual} = ${expected})`
    if (condition.operator === 'contains') return `(${prefix}strpos(${actual}, ${expected}) > 0)`
    const expression = regexCandidate(condition.value)
    return expression === null ? null : `(${prefix}${column} COLLATE "C" ~* ${bind(expression)})`
}

// Only narrow raw replay pages when the message comparison is representable in
// PostgreSQL. The full rule still runs on every returned candidate.
export function messageCandidatePredicate(conditions: Condition[], column: string, bind: (value: string) => string) {
    const ascii = `${column} !~ '[^\\x00-\\x7F]'`
    const trigramNeedles = column === 'normalized->>\'message\'' ? conditions.flatMap(condition => {
        if (condition.path !== 'message') return []
        const value = condition.operator === 'regex'
            ? /^\^([A-Za-z0-9 _:/@,=-]{3,})/.exec(condition.value)?.[1]
            : condition.value.length >= 3 ? condition.value : null
        if (!value || /[^A-Za-z0-9 _:/@,=-]/.test(value)) return []
        return [`translate(lower(normalized::text), ' ', '0') LIKE ${bind('%' + value.toLowerCase().replaceAll(' ', '0') + '%')}`]
    }) : []
    const predicates = conditions.filter(condition => condition.path === 'message').flatMap(condition => {
        if (condition.operator === 'regex') {
            const pattern = regexCandidate(condition.value)
            return pattern === null ? [] : [`(NOT (${ascii}) OR ${column} COLLATE "C" ${condition.caseSensitive ? '~' : '~*'} ${bind(pattern)})`]
        }
        const expected = bind(condition.caseSensitive ? condition.value : condition.value.toLowerCase())
        const actual = condition.caseSensitive ? column : `lower(${column} COLLATE "C")`
        return [`(NOT (${ascii}) OR ${condition.operator === 'equals' ? `${actual} = ${expected}` : `strpos(${actual}, ${expected}) > 0`})`]
    })
    const all = [...trigramNeedles, ...predicates]
    return all.length ? all.join(' AND ') : 'TRUE'
}

// These are candidate predicates, not a second rule engine. Keep the runtime
// recheck: JavaScript number formatting and Unicode folding differ from SQL.
export function previewPredicate(conditions: Condition[], params: (string | number | boolean | null | string[])[]) {
    const bind = (value: string | string[]) => { params.push(value); return `$${params.length}` }
    const predicates: string[] = []
    for (const condition of conditions) {
        const parts = condition.path.split('.')
        const path = bind(parts), json = `(normalized #> ${path}::text[])`, text = `(normalized #>> ${path}::text[])`
        predicates.push(`jsonb_typeof(${json}) IN ('string', 'number', 'boolean')`)
        const scalar = scalarColumns[condition.path]
        if (scalar) {
            const scalarPredicate = scalarCandidatePredicate(condition, scalar, bind)
            if (scalarPredicate) predicates.push(scalarPredicate)
        }
        // Array subscripts accepted by #> are not paths accepted by getPath.
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
