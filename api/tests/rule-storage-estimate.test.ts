import { expect, test } from 'bun:test'
import { estimateStoredRuleEvents } from '../src/utils/events/rulePreview.ts'
import { ReadAdmissionError } from '../src/utils/readCache.ts'

const condition = [{ path: 'event_type', operator: 'equals' as const, value: 'application' }]
const today = new Date().toISOString().slice(0, 10)

test('stores one successful estimate per rule version and UTC day', async () => {
    let row: { event_count: string, estimated_bytes: string, scanned_date: string, generated_at: string | null } | null = null
    let eventScans = 0
    const query = async (sql: string, params: unknown[] = []): Promise<any> => {
        if (sql.includes('INSERT INTO rule_storage_estimates')) {
            if (row?.scanned_date === today) return { rows: [] }
            const prior = row
            row = { event_count: prior?.event_count || '0', estimated_bytes: prior?.estimated_bytes || '0', scanned_date: today, generated_at: prior?.generated_at || null }
            return { rows: [{ ...row, claimed: true }] }
        }
        if (sql.includes('FROM rule_storage_estimates')) return { rows: row ? [{ ...row, claimed: false }] : [] }
        if (sql.includes('FROM rules r')) return { rows: [] }
        if (sql.includes('FROM events WHERE')) {
            eventScans++
            return { rows: [{ id: 'event-1', timestamp: '2026-09-28T10:00:00.000Z', normalized: { event_type: 'application', severity: 'low' }, original: {}, bytes: '15360' }] }
        }
        if (sql.includes('UPDATE rule_storage_estimates')) {
            row = { event_count: String(params[3]), estimated_bytes: String(params[4]), scanned_date: String(params[5]), generated_at: new Date().toISOString() }
            return { rows: [] }
        }
        throw new Error(`Unexpected query: ${sql}`)
    }

    const first = await estimateStoredRuleEvents('org-a', 'rule.a', '1', condition, query as any)
    const second = await estimateStoredRuleEvents('org-a', 'rule.a', '1', condition, query as any)
    expect(first).toMatchObject({ count: 1, bytes: 15360, checkedDate: today })
    expect(second).toMatchObject({ count: 1, bytes: 15360, checkedDate: today })
    expect(eventScans).toBe(1)
})

test('marks the day handled and keeps the previous estimate when the preview lane is busy', async () => {
    const yesterday = '2000-01-01'
    let row = { event_count: '9', estimated_bytes: '4096', scanned_date: yesterday, generated_at: '2026-09-27T10:00:00.000Z' }
    let scanAttempts = 0
    const query = async (sql: string): Promise<any> => {
        if (sql.includes('INSERT INTO rule_storage_estimates')) {
            if (row.scanned_date === today) return { rows: [] }
            row = { ...row, scanned_date: today }
            return { rows: [{ ...row, claimed: true }] }
        }
        if (sql.includes('FROM rule_storage_estimates')) return { rows: [{ ...row, claimed: false }] }
        if (sql.includes('FROM rules r')) { scanAttempts++; throw new ReadAdmissionError() }
        throw new Error(`Unexpected query: ${sql}`)
    }

    const first = await estimateStoredRuleEvents('org-a', 'rule.b', '2', condition, query as any)
    const second = await estimateStoredRuleEvents('org-a', 'rule.b', '2', condition, query as any)
    expect(first).toMatchObject({ count: 9, bytes: 4096, checkedDate: today })
    expect(second).toMatchObject({ count: 9, bytes: 4096, checkedDate: today })
    expect(scanAttempts).toBe(1)
})
