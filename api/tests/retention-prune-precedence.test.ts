import { expect, mock, test } from 'bun:test'
import { accessDefinition } from '../src/utils/mill/analyzeAccess.ts'
mock.module('#db', () => ({ default: async () => { throw new Error('Use test transaction') }, withTransaction: async (work: any) => work() }))
mock.module('../src/utils/mill/analyzeLog.ts', () => ({ platformAccessRule: async () => ({ organization_id: 'platform', enabled: true, created_at: new Date('2026-09-01'), definition: accessDefinition }) }))
const { pruneAccessLogs } = await import('../src/utils/mill/pruneAccessLogs.ts')
const log = { id: '42', service: 'cdn', level: 'info', message: 'http_access', created_at: '2026-08-01T00:00:00Z',
    metadata: { structured: { access: { ip: '192.0.2.1', path: '/public/file', method: 'GET', status: 200,
        inspection: { version: 1, bodyEmpty: true, headersSafe: true, pathSafe: true } } } } }
test('historical pruning honors Store without deleting evidence or incrementing drop counts', async () => {
    for (const enabled of [true, false]) {
        const writes: string[] = []
        const query: any = async (sql: string, params: unknown[]) => {
            if (sql.includes('FROM mill_rules r')) {
                expect(params[0]).toBe('platform')
                return { rows: [{ source: 'owned', enabled, definition: { stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'cdn' }] } }] }
            }
            if (sql.startsWith('SELECT')) return { rows: [] }
            writes.push(sql); return { rows: [] }
        }
        expect([...await pruneAccessLogs([log], 'platform', query)]).toEqual(enabled ? [] : ['42'])
        expect(writes.length > 0).toBe(!enabled)
    }
})
