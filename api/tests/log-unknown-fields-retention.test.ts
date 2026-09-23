import { createHash } from 'node:crypto'
import { expect, mock, test } from 'bun:test'

mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('Unexpected database access') },
    withTransaction: async () => { throw new Error('Expected caller transaction') } }))
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')

function fixture() {
    const args = ['ausearch', '--input-logs', '--checkpoint', '/var/lib/hanasand-log-collector/audit-live.pending', '-k', 'hanasand_exec', '--raw']
    return { host: 'inspur', service: 'audit', level: 'info' as const, message: args.join(' '), timestamp: '2026-09-23T20:00:00.010Z',
        sourceEventId: createHash('sha256').update('inspur:audit:msg=audit(1790193600.010:42)').digest('hex'),
        metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: '42',
            user: { id: '0', login_id: '4294967295' },
            process: { executable: '/usr/sbin/ausearch', command_line: args.join(' '), arguments: args, pid: '12345', parent_pid: '12000' },
            collector_execution: { unit: 'hanasand-log-collector.service', boot_id: '3e735e7b-4d7f-444d-9806-231fa26cfcec', pid: '12345', parent_pid: '12000',
                started_at: 1790193600000, finished_at: 1790193600100, executable: '/usr/sbin/ausearch', arguments: args, exit_code: 0, stderr_empty: true } } }
}

function database(customDrop = false) {
    let stored: unknown[][] = [], receipts = 0
    const query: any = async (sql: string, params: any[] = []) => {
        if (sql.includes("r.source='owned'")) return { rows: customDrop ? [{ source: 'owned', enabled: true,
            definition: { stage: 'analyze', action: 'drop', conditions: [{ path: 'service', operator: 'equals', value: 'audit' }] } }] : [] }
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform', version: '1', enabled: true }] }
        if (sql.includes('INSERT INTO log_analyze_receipts')) { receipts++; return { rows: [], rowCount: 1 } }
        if (sql.includes('INSERT INTO service_logs')) { stored = sql.includes('WITH input AS') ? JSON.parse(params[0]) : [params]; return { rows: [], rowCount: stored.length } }
        throw new Error(`Unexpected query: ${sql}`)
    }
    return { query, get stored() { return stored }, get receipts() { return receipts } }
}

test('unknown outer evidence cannot disappear before a built-in drop decision', async () => {
    const baseline = database()
    await recordLogBatch([fixture()], baseline.query)
    expect(baseline.receipts).toBe(1)
    expect(baseline.stored).toHaveLength(0)

    for (const extras of [{ unexpected: 'suspicious-evidence-marker' }, { detections: [{ summary: 'suspicious-evidence-marker' }] },
        JSON.parse('{"__proto__":{"evidence":"suspicious-evidence-marker"}}')]) {
        const db = database()
        await recordLogBatch([{ ...fixture(), ...extras }], db.query)
        expect(db.receipts).toBe(0)
        expect(db.stored).toHaveLength(1)
        expect(JSON.stringify(db.stored)).toContain('suspicious-evidence-marker')
    }
})

test('single and batch ingestion preserve extras despite custom drop rules and marker collisions', async () => {
    for (const batch of [false, true]) {
        const original = fixture()
        const log = { ...original, extra: 'outer-evidence', metadata: { ...original.metadata, unrecognized_ingest_fields: 'prior-evidence' } }
        const db = database(true)
        if (batch) await recordLogBatch([log], db.query)
        else await recordLog(log, db.query)
        expect(db.receipts).toBe(0)
        expect(db.stored).toHaveLength(1)
        const metadata = JSON.parse(db.stored[0][4] as string)
        expect(metadata.unrecognized_ingest_fields.fields.extra).toBe('outer-evidence')
        expect(metadata.unrecognized_ingest_fields.previous).toBe('prior-evidence')
        expect(metadata.process).toEqual(original.metadata.process)
    }
})
