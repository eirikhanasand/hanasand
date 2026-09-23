import { expect, mock, test } from 'bun:test'
import { accessDefinition, inspectAccess } from '../src/utils/mill/analyzeAccess.ts'
mock.module('#db', () => ({ default: async () => ({ rows: [] }), withTransaction: async (work: any) => work() }))
mock.module('#utils/auth/sessionNetwork.ts', () => ({ sessionNetwork: async () => ({}) }))
const { analyzeAccess } = await import('../src/utils/mill/analyzeLog.ts')
test('Low-only retention cannot demote a separate DDoS alert', async () => {
    for (const configured of ['low', 'medium', 'high', 'critical']) {
        let findingSeverity = ''
        const now = Date.now()
        const query = async (sql: string, params: any[]) => {
            if (sql.includes('LEFT JOIN mill_rules')) return { rows: [{ organization_id: 'org-a', enabled: true, severity: configured, definition: accessDefinition, version: '1' }] }
            if (sql.includes('INSERT INTO log_analyze_receipts')) return { rows: [], rowCount: 1 }
            if (sql.includes('SELECT recent')) return { rows: [{ recent: Array.from({ length: 50 }, () => now), alerted_at: null }] }
            if (sql.includes('INSERT INTO mill_findings')) findingSeverity = params[6]
            return { rows: [] }
        }
        expect(await analyzeAccess({ key: 'http-api:test', timestamp: new Date(now).toISOString(), ip: '192.0.2.1', method: 'GET', path: '/public', status: 200, inspection: inspectAccess({ url: '/public', headers: { host: 'example.com' } }) }, query as any)).toBe(true)
        expect(findingSeverity).toBe(configured === 'critical' ? 'critical' : 'high')
    }
})
