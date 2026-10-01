import { expect, mock, test } from 'bun:test'

let selectedLimit = 0
mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT log_key FROM events')) {
        selectedLimit = Number(params[0])
        return { rows: [{ log_key: 'service:1' }] }
    }
    if (sql.includes('SELECT * FROM service_logs')) return { rows: [{ id: '1' }] }
    if (sql.includes('UPDATE events SET')) return { rows: [] }
    throw new Error(`Unexpected query: ${sql}`)
} }))
mock.module('../src/utils/events/storedSources.ts', () => ({ storedSourceLog: (_source: string, row: unknown) => row }))

const { recoverUnassignedLogs } = await import('../src/utils/events/recoverUnassignedLogs.ts')

test('supports the dedicated worker recovery cap of 700 records', async () => {
    let processed = 0
    await recoverUnassignedLogs(async logs => { processed = logs.length }, 700)
    expect(selectedLimit).toBe(700)
    expect(processed).toBe(1)
})

test('rejects unassigned recovery batches above its bounded cap', async () => {
    await expect(recoverUnassignedLogs(async () => {}, 701)).rejects.toThrow('Invalid unassigned log recovery limit')
})
