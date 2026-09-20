import { createHash } from 'node:crypto'
import type { queryOnce } from '#db'

type Input = { where: string[], params: NonNullable<Parameters<typeof queryOnce>[1]>, order: string, limit: number, cursor?: string, recentFirst?: boolean }
type Cursor = { time: string, id: string, until: string, scope: string }

export async function searchLogPage(query: typeof queryOnce, input: Input) {
    const scope = createHash('sha256').update(JSON.stringify([input.where, input.params, input.order, input.limit])).digest('hex')
    let cursor: Cursor | undefined
    if (input.cursor) {
        try {
            if (input.cursor.length > 2048) throw new Error()
            cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString())
            if (!cursor || cursor.scope !== scope || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 200
                || typeof cursor.time !== 'string' || !Number.isFinite(Date.parse(cursor.time))
                || typeof cursor.until !== 'string' || !Number.isFinite(Date.parse(cursor.until))) throw new Error()
        } catch { throw new Error('Invalid search cursor. Start the search again.') }
    }
    const params = [...input.params]
    const bind = (value: string) => { params.push(value); return `$${params.length}` }
    const until = cursor?.until || new Date().toISOString()
    const snapshot = bind(until) + '::timestamptz'
    // Keep the time window fixed across pages, including microsecond sort keys.
    const where = input.where.map(clause => clause.replaceAll('NOW()', snapshot))
    where.push(`event_timestamp <= ${snapshot}`)
    if (cursor) where.push(`(event_timestamp, id) < (${bind(cursor.time)}::timestamptz, ${bind(cursor.id)}::text)`)
    const select = (clauses: string[]) => `SELECT id, normalized, event_timestamp, organization_id, event_timestamp::text AS cursor_time FROM mill_events WHERE ${clauses.join(' AND ')} ORDER BY ${input.order} LIMIT ${input.limit + 1}`
    // Common phrases can match tens of thousands of events. A full page from
    // the newest five minutes is already the correct page for the entire range.
    // Otherwise fall back to the complete search, never a partial result set.
    let result = input.recentFirst ? await query(select([...where, `event_timestamp >= $${params.length + 1}::timestamptz`]),
        [...params, new Date(Date.parse(cursor?.time || until) - 5 * 60_000).toISOString()]) : undefined
    if (!result || result.rows.length < input.limit + 1) result = await query(select(where), params)
    const page = result.rows.slice(0, input.limit)
    const last = page.at(-1)
    const next = result.rows.length > input.limit && last
        ? Buffer.from(JSON.stringify({ time: last.cursor_time, id: last.id, until, scope })).toString('base64url') : null
    return { rows: page.map(({ id, normalized, event_timestamp, organization_id }) => ({ id, normalized, event_timestamp, organization_id })), next_cursor: next }
}
