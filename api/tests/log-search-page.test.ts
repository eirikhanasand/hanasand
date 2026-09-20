import { expect, test } from 'bun:test'
import type { queryOnce } from '../src/utils/db.ts'
import { searchLogPage } from '../src/utils/logs/searchPage.ts'

const input = { where: ["ingestion_id = 'logs'", "processing_status = 'processed'", "event_timestamp >= NOW() - $1 * INTERVAL '1 hour'", "strpos(lower(normalized::text), lower($2)) > 0", "EXISTS (SELECT 1 FROM organizations o WHERE o.id = mill_events.organization_id AND o.status = 'active')"], params: [24, 'docker logs'], order: 'event_timestamp DESC, id DESC', limit: 2 }
test('pages preserve full filters, fixed time range and microsecond timestamp/id ties', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const rows = ['c', 'b', 'a'].map(id => ({ id, normalized: {}, cursor_time: '2026-09-20 00:00:00.123456+00' }))
    const query = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows: calls.length === 1 ? rows : [rows[2]] } }) as unknown as typeof queryOnce
    const first = await searchLogPage(query, input)
    expect(first.rows.map(row => row.id)).toEqual(['c', 'b'])
    expect(first.rows[0]).not.toHaveProperty('cursor_time')
    expect(first.next_cursor).toBeString()
    const second = await searchLogPage(query, { ...input, cursor: first.next_cursor! })
    expect(second.rows.map(row => row.id)).toEqual(['a'])
    expect(second.next_cursor).toBeNull()
    expect(calls[1].params).toEqual([24, 'docker logs', calls[0].params[2], '2026-09-20 00:00:00.123456+00', 'b'])
    for (const { sql } of calls) {
        expect(sql).toContain("o.status = 'active'")
        expect(sql).toContain('strpos(lower(normalized::text), lower($2)) > 0')
        expect(sql).toContain("event_timestamp >= $3::timestamptz - $1 * INTERVAL '1 hour'")
        expect(sql).toEndWith('ORDER BY event_timestamp DESC, id DESC LIMIT 3')
    }
    expect(calls[1].sql).toContain('(event_timestamp, id) < ($4::timestamptz, $5::text)')
})
test('malformed and different-search cursors fail before any query', async () => {
    let calls = 0
    const query = (async () => { calls++; return { rows: [] } }) as unknown as typeof queryOnce
    for (const cursor of ['!', 'a'.repeat(2049), Buffer.from(JSON.stringify({ scope: 'other', time: 'bad', id: 'b' })).toString('base64url')]) {
        await expect(searchLogPage(query, { ...input, cursor })).rejects.toThrow('Invalid search cursor')
    }
    expect(calls).toBe(0)
    expect((await searchLogPage(query, input)).next_cursor).toBeNull()
})
test('a complete recent page avoids scanning older matches and preserves the cursor', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const rows = ['c', 'b', 'a'].map(id => ({ id, normalized: {}, cursor_time: '2026-09-20 00:00:00.123456+00' }))
    const query = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows } }) as unknown as typeof queryOnce
    const first = await searchLogPage(query, { ...input, recentFirst: true })
    expect(calls).toHaveLength(1)
    expect(first.rows.map(row => row.id)).toEqual(['c', 'b'])
    expect(first.next_cursor).toBeString()
    expect(calls[0].sql).toContain("o.status = 'active'")
    expect(calls[0].sql).toContain('event_timestamp >= $4::timestamptz')
    expect(Date.parse(calls[0].params[2] as string) - Date.parse(calls[0].params[3] as string)).toBe(900_000)
    await searchLogPage(query, { ...input, recentFirst: true, cursor: first.next_cursor! })
    expect(calls[1].sql).toContain('(event_timestamp, id) < ($4::timestamptz, $5::text)')
    expect(calls[1].params[3]).toBe('2026-09-20 00:00:00.123456+00')
    expect(calls[1].params[5]).toBe('2026-09-19T23:45:00.123Z')
})
test('sparse and exactly full recent pages fall back to the entire original range', async () => {
    for (const recent of [[], [{ id: 'c' }], [{ id: 'c' }, { id: 'b' }]]) {
        const calls: Array<{ sql: string, params: unknown[] }> = []
        const query = (async (sql: string, params: unknown[]) => {
            calls.push({ sql, params })
            return { rows: calls.length === 1 ? recent : [{ id: 'c' }, { id: 'b' }, { id: 'older', cursor_time: '2026-09-19 12:00:00+00' }] }
        }) as unknown as typeof queryOnce
        const result = await searchLogPage(query, { ...input, recentFirst: true })
        expect(calls).toHaveLength(2)
        expect(calls[1].params).toEqual(calls[0].params.slice(0, -1))
        expect(calls[1].sql).not.toContain('event_timestamp >= $4::timestamptz')
        expect(calls[1].sql).toContain("event_timestamp >= $3::timestamptz - $1 * INTERVAL '1 hour'")
        expect(result.rows.map(row => row.id)).toEqual(['c', 'b'])
        expect(result.next_cursor).toBeString()
    }
})
