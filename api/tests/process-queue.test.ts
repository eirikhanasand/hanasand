import { beforeEach, expect, mock, test } from 'bun:test'
let queue: { id: string }[], recovered: { id: string }[], calls: string[], recoveryId: string, complete: Set<string>
const query = async (sql: string, args: any[] = []) => {
    calls.push(sql)
    if (sql.startsWith('SELECT COALESCE(MAX(log_id)')) return { rows: [{ id: queue.reduce((max, row) => BigInt(row.id) > BigInt(max) ? row.id : max, '0') }] }
    if (sql.includes('FROM log_process_queue q JOIN')) return { rows: queue.filter(row => BigInt(row.id) <= BigInt(args[0])).slice(0, 1000) }
    if (sql.startsWith('DELETE FROM log_process_queue')) { queue = queue.filter(row => !args[0].includes(row.id) || !complete.has(row.id)); return { rows: [] } }
    if (sql.startsWith('SELECT recent_id')) return { rows: [{ recent_id: recoveryId }] }
    if (sql.startsWith('SELECT id FROM service_logs')) return { rows: recovered.filter(row => BigInt(row.id) <= BigInt(args[0])).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 10000) }
    if (sql.startsWith('SELECT s.* FROM service_logs')) return { rows: recovered.filter(row => args[0].includes(row.id) && !complete.has(row.id)).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 1000) }
    if (sql.startsWith('UPDATE log_processing_cursors')) { recoveryId = args[0]; return { rows: [] } }
    if (sql.includes('AS oldest_queued_at')) return { rows: [{ count: Math.min(queue.length, 10001), oldest_queued_at: queue.length ? '2026-09-19T14:49:32Z' : null }] }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
const { processQueuedLogs, recoverProcessLogs, readPendingProcessLogs } = await import('../src/utils/mill/processQueue.ts')
beforeEach(() => { queue = []; recovered = []; calls = []; recoveryId = '0'; complete = new Set() })
const process = async (rows: any[]) => { for (const row of rows) complete.add(row.id) }
test('continuous newer arrivals cannot displace an admitted older command; work is capped', async () => {
    queue = Array.from({ length: 5100 }, (_, id) => ({ id: String(id + 1) }))
    await processQueuedLogs( async rows => {
        await process(rows)
        queue.push(...Array.from({ length: 1000 }, (_, id) => ({ id: String(10001 + id) })))
    })
    expect(complete.has('1')).toBe(true)
    expect(complete.size).toBe(4000)
    expect(queue[0].id).toBe('4001')
    expect(calls.filter(sql => sql.includes('FROM log_process_queue q JOIN'))).toHaveLength(4)
})
test('failure keeps queue entries; replay removes only events durably processed or safely skipped', async () => {
    queue = [{ id: '1' }, { id: '2' }]
    await expect(processQueuedLogs( async rows => { complete.add(String(rows[0].id)); throw new Error('write failed') })).rejects.toThrow('write failed')
    expect(queue).toHaveLength(2)
    await processQueuedLogs( async () => {})
    expect(queue).toEqual([{ id: '2' }])
    await processQueuedLogs( process)
    expect(queue).toHaveLength(0)
})
test('fixed recovery cursor advances only after success and is independent of arrivals and event age', async () => {
    recoveryId = '2000'; recovered = Array.from({ length: 2000 }, (_, id) => ({ id: String(id + 1) }))
    await expect(recoverProcessLogs(async () => { throw new Error('failed') })).rejects.toThrow('failed')
    expect(recoveryId).toBe('2000')
    recovered.push({ id: '2001' })
    await recoverProcessLogs(process)
    expect(recoveryId).toBe('1000'); expect(complete.has('2001')).toBe(false)
    await recoverProcessLogs(process)
    expect(recoveryId).toBe('0'); expect(complete.size).toBe(2000)
})
test('status count is bounded and retains oldest queue age', async () => {
    expect(await readPendingProcessLogs()).toEqual({ count: 0, has_more: false, oldest_queued_at: null })
    queue = Array.from({ length: 12000 }, (_, id) => ({ id: String(id) }))
    expect(await readPendingProcessLogs()).toEqual({ count: 10000, has_more: true, oldest_queued_at: '2026-09-19T14:49:32Z' })
    expect(calls.at(-1)).toContain('LIMIT 10001')
})
test('recovery skips only inspected completed IDs and bounds sparse backlog reads', async () => {
    recoveryId = '20000'; recovered = Array.from({ length: 20000 }, (_, id) => ({ id: String(id + 1) }))
    for (let id = 10001; id <= 20000; id++) complete.add(String(id))
    const checked: string[] = []
    await recoverProcessLogs(async rows => { checked.push(...rows.map(row => String(row.id))); await process(rows) })
    expect(checked).toEqual([])
    expect(recoveryId).toBe('10000')
    await recoverProcessLogs(async rows => { checked.push(...rows.map(row => String(row.id))); await process(rows) })
    expect(checked).toHaveLength(1000)
    expect(checked[0]).toBe('10000')
    expect(recoveryId).toBe('9000')
    expect(calls.filter(sql => sql.startsWith('SELECT id FROM service_logs')).every(sql => sql.includes('LIMIT 10000'))).toBe(true)
})
test('mixed completed and unfinished recovery pages never skip the remainder of a candidate window', async () => {
    recoveryId = '10000'; recovered = Array.from({ length: 10000 }, (_, id) => ({ id: String(id + 1) }))
    for (let id = 2; id <= 10000; id += 2) complete.add(String(id))
    let checked = 0
    for (let page = 0; page < 5; page++) await recoverProcessLogs(async rows => { checked += rows.length; await process(rows) })
    expect(checked).toBe(5000)
    expect(complete.size).toBe(10000)
    expect(recoveryId).toBe('0')
})
