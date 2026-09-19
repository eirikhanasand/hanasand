const fields: Record<string, string> = {
    TimeGenerated: 'event_timestamp', Severity: 'normalized->>\'severity\'', Level: 'normalized->>\'level\'',
    Service: 'normalized->>\'service\'', Host: 'normalized->>\'host\'', Message: 'normalized->>\'message\'',
    LogType: 'normalized->>\'log_type\'', CommandLine: 'normalized#>>\'{process,command_line}\'',
    Executable: 'normalized#>>\'{process,executable}\'', UserId: 'user_id', RuleId: 'normalized->\'detections\'',
}
export const logTables = ['Logs', 'SigninLogs', 'ApplicationLogs', 'ProcessLogs', 'HttpLogs', 'SystemLogs']
export function compileLogQuery(input: string) {
    if (input.length > 8000) throw new Error('Query is too long (maximum 8,000 characters).')
    const tokens: string[] = []
    const pattern = /\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|>=|<=|==|!=|[|(),><]|\d+(?:\.\d+)?[smhd]?|[A-Za-z_][A-Za-z0-9_.]*|\*)/gy
    let offset = 0
    while (offset < input.trimEnd().length) {
        pattern.lastIndex = offset
        const match = pattern.exec(input)
        if (!match) throw new Error(`Unexpected query text near character ${offset + 1}.`)
        tokens.push(match[1]); offset = pattern.lastIndex
    }
    let index = 0
    const params: Array<string | number> = []
    const bind = (value: string | number) => { params.push(value); return `$${params.length}` }
    const next = () => tokens[index++]
    const peek = () => tokens[index]?.toLowerCase()
    const requireToken = (value: string) => { if (next()?.toLowerCase() !== value) throw new Error(`Expected ${value}.`) }
    const field = () => { const name = next(); if (!fields[name]) throw new Error(`Unknown field ${name || '(missing)'}.`); return { name, sql: fields[name] } }
    const value = (): string => {
        const token = next()
        if (token?.startsWith('"') || token?.startsWith('\'')) return bind(token.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c as string] || c)))
        if (/^\d+(?:\.\d+)?$/.test(token || '')) return bind(Number(token))
        if (token?.toLowerCase() === 'ago') {
            requireToken('('); const duration = next(); requireToken(')')
            const match = /^(\d+)([smhd])$/.exec(duration || '')
            const seconds = match ? Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]] || 1) : NaN
            if (!Number.isFinite(seconds) || seconds < 1 || seconds > 365 * 86400) throw new Error('Use ago(24h), ago(7d), or another duration up to 365 days.')
            return `(NOW() - ${bind(seconds)} * INTERVAL '1 second')`
        }
        throw new Error('Expected a quoted value, number, or ago(duration).')
    }
    const atom = (): string => {
        if (peek() === 'not') { next(); return `(NOT ${atom()})` }
        if (peek() === '(') { next(); const result = or(); requireToken(')'); return `(${result})` }
        const left = field(); const operator = next()?.toLowerCase()
        if (operator === 'in') {
            requireToken('('); const values = [value()]
            while (peek() === ',') { next(); values.push(value()) }
            requireToken(')'); return left.name === 'RuleId' ? `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${left.sql}, '[]'::jsonb)) detection WHERE detection->>'rule_id' IN (${values.join(', ')}))` : `${left.sql} IN (${values.join(', ')})`
        }
        if (['==', '!=', '>', '<', '>=', '<='].includes(operator)) {
            const right = value()
            if (left.name === 'RuleId') {
                if (!['==', '!='].includes(operator)) throw new Error('RuleId supports ==, !=, in, contains and has.')
                return `${operator === '!=' ? 'NOT ' : ''}EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${left.sql}, '[]'::jsonb)) detection WHERE detection->>'rule_id' = ${right})`
            }
            return `${left.sql} ${operator === '==' ? '=' : operator === '!=' ? '<>' : operator} ${right}`
        }
        if (['contains', 'has', 'startswith', 'endswith'].includes(operator)) {
            const param = value()
            if (left.name === 'TimeGenerated') throw new Error('Use a comparison operator for TimeGenerated.')
            const text = left.name === 'RuleId' ? 'detection->>\'rule_id\'' : left.sql
            const match = operator === 'has' ? `lower(${param}::text) = ANY(regexp_split_to_array(lower(COALESCE(${text}, '')), '[^[:alnum:]]+'))`
                : operator === 'endswith' ? `right(lower(COALESCE(${text}, '')), length(${param}::text)) = lower(${param}::text)`
                    : operator === 'startswith' ? `left(lower(COALESCE(${text}, '')), length(${param}::text)) = lower(${param}::text)`
                        : `strpos(lower(COALESCE(${text}, '')), lower(${param}::text)) > 0`
            return left.name === 'RuleId' ? `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${left.sql}, '[]'::jsonb)) detection WHERE ${match})` : match
        }
        throw new Error(`Unsupported operator ${operator || '(missing)'}.`)
    }
    const and = (): string => { let sql = atom(); while (peek() === 'and') { next(); sql = `(${sql} AND ${atom()})` } return sql }
    const or = (): string => { let sql = and(); while (peek() === 'or') { next(); sql = `(${sql} OR ${and()})` } return sql }
    const table = next() || 'Logs'
    if (!logTables.includes(table)) throw new Error(`Choose a table: ${logTables.join(', ')}.`)
    const where = table === 'Logs' ? [] : [`normalized->>'log_type' = ${bind(table)}`]
    let order = 'event_timestamp DESC, id DESC', limit = 100
    let projection: string[] | null = null, summarize: string | null = null
    let taken = false, ordered = false
    while (index < tokens.length) {
        requireToken('|')
        const operation = next()?.toLowerCase()
        if (taken) throw new Error('take must be the final operator in this KQL subset.')
        if ((projection || summarize) && operation !== 'take' && operation !== 'limit') throw new Error('Only take may follow project or summarize in this KQL subset.')
        if (operation === 'where') {
            if (ordered) throw new Error('Put where before order by in this KQL subset.')
            where.push(or())
        }
        else if (operation === 'take' || operation === 'limit') {
            const count = next()
            if (!/^\d+$/.test(count || '') || Number(count) < 1 || Number(count) > 500) throw new Error('Take must be between 1 and 500.')
            limit = Number(count); taken = true
        } else if (operation === 'sort' || operation === 'order') {
            if (ordered) throw new Error('Use one order by clause in this KQL subset.')
            ordered = true
            requireToken('by'); const selected = field(); const direction = next()?.toLowerCase()
            if (direction !== 'asc' && direction !== 'desc') throw new Error('Use asc or desc.')
            order = `${selected.sql} ${direction.toUpperCase()}, id DESC`
        } else if (operation === 'project') {
            projection = [field().name]
            while (peek() === ',') { next(); projection.push(field().name) }
        } else if (operation === 'summarize') {
            if (ordered) throw new Error('Order by before summarize is unsupported; counts are sorted descending.')
            requireToken('count'); requireToken('('); requireToken(')'); requireToken('by')
            summarize = field().name
        } else throw new Error(`Unsupported operator ${operation}. Supported: where, project, order by, take, summarize count() by.`)
    }
    if (summarize && projection) throw new Error('Use summarize or project, not both.')
    return { params, where, order, limit, projection, summarize, fields }
}
