import { expect, mock, test } from 'bun:test'

let pending = 0
let oldest: string | null = null
const calls: string[] = []
const query = async (sql: string) => {
    calls.push(sql)
    if (sql.includes('bounded) AS count')) return { rows: [{ count: Math.min(pending, 10001), oldest_queued_at: oldest }] }
    throw new Error(`Unexpected SQL: ${sql}`)
}
mock.module('#db', () => ({ default: query }))
const { readPendingProcessLogs } = await import('../src/utils/events/processQueue.ts')

test('pending service logs are counted from Events and retain the oldest receipt time', async () => {
    pending = 27
    oldest = '2026-09-19T14:49:32Z'
    expect(await readPendingProcessLogs()).toEqual({ count: 27, has_more: false, oldest_queued_at: oldest })
    expect(calls[0]).toContain("FROM events WHERE ingestion_id='logs' AND processing_status='pending'")
    expect(calls[0]).not.toContain('service_logs')
    expect(calls[0]).not.toContain('log_process_queue')
})

test('pending work status is capped at 10000 and signals more rows', async () => {
    pending = 10001
    oldest = '2026-09-19T14:49:32Z'
    expect(await readPendingProcessLogs()).toEqual({ count: 10000, has_more: true, oldest_queued_at: oldest })
})
