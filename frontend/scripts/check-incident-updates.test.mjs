import { expect, test } from 'bun:test'
import meaningfulIncidentUpdates from '../src/utils/status/incidentUpdates'

const repeat = 'The availability check was still failing.'
const initial = 'Automated monitoring detected a problem with this component.'
const row = (minute, evidence, message = repeat, status = 'monitoring') => ({ at: new Date(Date.UTC(2026, 8, 12, 0, minute)).toISOString(), status, message, evidence })

test('repeated failures and increasing stale ages add no updates, but new symptoms and recovery do', () => {
    const rows = [row(0, 'Latest customer activity is stale (138 minutes).', initial, 'investigating'), row(1, 'Latest customer activity is stale (165 minutes).'), row(2, 'The operation timed out.'), row(3, 'The operation timed out.'), row(4, 'Fresh activity.', 'A successful check confirmed recovery.', 'resolved')]
    const result = meaningfulIncidentUpdates(rows.reverse())
    expect(result).toHaveLength(3)
    expect(result.map(update => update.status)).toEqual(['resolved', 'monitoring', 'investigating'])
    expect(result[1].message).toBe('The monitoring check timed out.')
    expect(result[1].at).toBe(row(2, '').at)
    expect(result[2].evidence).toContain('138 minutes')
    expect(result.some(update => update.message === repeat)).toBe(false)
    expect(rows).toHaveLength(5)
})

test('new errors and authored findings remain, while previously reported symptoms do not repeat', () => {
    const rows = [row(0, 'HTTP 500', initial, 'investigating'), row(1, 'HTTP 503'), row(2, 'HTTP 500'), row(3, 'HTTP 500', 'The database connection pool is exhausted.'), row(4, 'HTTP 500', 'The connection limit was increased.')]
    const result = meaningfulIncidentUpdates(rows)
    expect(result).toHaveLength(4)
    expect(result[0].message).toBe('The connection limit was increased.')
    expect(result[2].message).toBe('HTTP 503')
    expect(result[2].evidence).toBeUndefined()
})

test('an unchanged ongoing failure keeps its original detection without inventing progress', () => {
    const result = meaningfulIncidentUpdates([row(0, 'The operation timed out.', initial, 'investigating'), row(1, 'The operation timed out.'), row(2, '')])
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('investigating')
})
