import { expect, test } from 'bun:test'
import { completedPostgresSessions, postgresSessionEvidence, postgresReceipt, postgresTimingAllowed, postgresDefinition, type PostgresLog } from '../src/utils/mill/analyzePostgres.ts'

export function fixture(now = Date.now() - 1000): PostgresLog[] {
    return ['connection received: host=[local]', 'connection authorized: user=hanasand database=hanasand application_name=pg_isready',
        'disconnection: session time: 0:00:00.005 user=hanasand database=hanasand host=[local]'].map((message, i) => {
        const timestamp = new Date(now + [0, 2, 5][i]).toISOString()
        return { host: 'inspur', service: 'hanasand_database', level: 'info', timestamp, sourceEventId: String(i + 1).repeat(64),
            message: `${timestamp.replace('T', ' ').replace('Z', '')} UTC [123] LOG:  ${message}`,
            metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stderr' } }
    })
}

test('complete configured readiness sessions retain every original field in one evidence record', () => {
    const logs = fixture(), sessions = completedPostgresSessions(logs)
    expect(sessions).toHaveLength(1)
    expect(postgresSessionEvidence(sessions[0]).lifecycle_records).toEqual(logs)
    expect(sessions[0].durationMs).toBe(5)
    expect(completedPostgresSessions([...logs].reverse())[0]).toEqual(sessions[0])
})

test('fail closed for suspicious or unfamiliar fields at every level', () => {
    const mutations: ((rows: PostgresLog[]) => void)[] = [
        r => { r[0].host = 'ovhcloud' }, r => { r[0].service = 'hanasand-db-standby' },
        r => { Object.assign(r[0], { suspicious: 'unexpected' }) },
        r => { r[0].level = 'error' }, r => { r[0].sourceEventId = '' },
        r => { r[0].metadata!.organizationId = 'tenant' }, r => { r[0].metadata!.detections = ['attack'] },
        r => { r[0].metadata!.unexpected = 'payload' }, r => { r[0].metadata!.stream = 'stdout' },
        r => { r[0].metadata!.container_id = 'different' }, r => { r[0].timestamp = 'bad' },
        r => { r[0].message += '\nFATAL: suspicious' }, r => { r[0].message += ' extra' },
        r => { r[0].message = r[0].message.replace('[local]', '127.0.0.1 port=1000') },
        r => { r[1].message = r[1].message.replace('database=hanasand', 'database=postgres') },
        r => { r[1].message = r[1].message.replace('user=hanasand', 'user=attacker') },
        r => { r[2].message = r[2].message.replace('00.005', '00.900') },
        r => { r[2].message = r[2].message.replace('[123]', '[124]') },
        r => { r[2].sourceEventId = r[0].sourceEventId },
        r => { r.push({ ...r[0], message: r[0].message.replace('LOG:  connection received: host=[local]', 'ERROR:  permission denied') }) },
    ]
    for (const mutate of mutations) { const rows = fixture(); mutate(rows); expect(completedPostgresSessions(rows)).toEqual([]) }
})

test('retain incomplete batches, historic unverified traffic and PID reuse', () => {
    const rows = fixture()
    for (const part of [rows.slice(0, 1), rows.slice(1), [...rows, ...rows]]) expect(completedPostgresSessions(part)).toEqual([])
    expect(postgresTimingAllowed(completedPostgresSessions(fixture(Date.now() - 120_000))[0], postgresDefinition.parameters)).toBe(false)
    expect(postgresTimingAllowed(completedPostgresSessions(fixture(Date.now() + 60_000))[0], postgresDefinition.parameters)).toBe(false)
})

test('retry identity includes evidence, not just a claimed source ID', () => {
    const log = fixture()[0]
    expect(postgresReceipt(log)).toBe(postgresReceipt({ ...log, metadata: Object.fromEntries(Object.entries(log.metadata!).reverse()) }))
    expect(postgresReceipt(log)).not.toBe(postgresReceipt({ ...log, message: log.message + ' suspicious' }))
    expect(postgresReceipt(log)).not.toBe(postgresReceipt({ ...log, metadata: { ...log.metadata, detections: ['attack'] } }))
})

test('generic correlation isolates source identity and extracts evidence without retention selectors', () => {
    const local=fixture(), other=fixture().map(row=>({...row,host:'other',service:'other-db',sourceEventId:postgresReceipt(row),message:row.message.replace('pg_isready','custom_probe')}))
    const sessions=completedPostgresSessions([...local,...other])
    expect(sessions).toHaveLength(2)
    expect(new Set(sessions.map(session=>session.key)).size).toBe(2)
    expect(sessions.find(session=>session.host==='other')?.application).toBe('custom_probe')
    expect(completedPostgresSessions([local[0],other[1],local[2]])).toEqual([])
    const network=fixture().map(row=>({...row,message:row.message.replace('[local]','192.0.2.1 port=12345')}))
    expect(completedPostgresSessions(network)[0].client).toBe('192.0.2.1 port=12345')
})
