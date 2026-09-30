import { beforeEach, expect, mock, test } from 'bun:test'

let watermarkCount = 4, queueTrigger = true
let statements: string[] = []
const query = async (sql: string) => {
    statements.push(sql)
    if (sql.startsWith('SELECT\n')) return { rows: [{ watermark_count: watermarkCount, queue_trigger: queueTrigger }] }
    return { rows: [] }
}

mock.module('#db', () => ({
    default: query,
    withTransaction: async (work: (query: typeof query) => Promise<unknown>) => work(query),
}))

const { default: ensureLogProcessQueueSchema } = await import('../src/utils/db/logProcessQueueSchema.ts')

beforeEach(() => { watermarkCount = 4; queueTrigger = true; statements = [] })

test('an installed watermark and queue barrier do not reacquire source table locks', async () => {
    await ensureLogProcessQueueSchema()

    expect(statements.filter(sql => sql.startsWith('LOCK TABLE'))).toEqual([])
    expect(statements.some(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_watermark_writer_lock'))).toBe(false)
    expect(statements.some(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_process_queue_insert'))).toBe(false)
    expect(statements.at(-1)).toContain('CREATE INDEX IF NOT EXISTS idx_service_logs_process_id')
})

test('missing watermark barriers are installed while locking all sources in order', async () => {
    watermarkCount = 3
    await ensureLogProcessQueueSchema()

    expect(statements.filter(sql => sql.startsWith('LOCK TABLE'))).toEqual([
        'LOCK TABLE service_logs IN SHARE ROW EXCLUSIVE MODE',
        'LOCK TABLE login_events IN SHARE ROW EXCLUSIVE MODE',
        'LOCK TABLE traffic_events IN SHARE ROW EXCLUSIVE MODE',
        'LOCK TABLE system_events IN SHARE ROW EXCLUSIVE MODE',
    ])
    expect(statements.filter(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_watermark_writer_lock'))).toHaveLength(4)
    expect(statements.some(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_process_queue_insert'))).toBe(false)
})

test('a missing queue trigger locks only service logs when watermark barriers exist', async () => {
    queueTrigger = false
    await ensureLogProcessQueueSchema()

    expect(statements.filter(sql => sql.startsWith('LOCK TABLE'))).toEqual(['LOCK TABLE service_logs IN SHARE ROW EXCLUSIVE MODE'])
    expect(statements.some(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_watermark_writer_lock'))).toBe(false)
    expect(statements.filter(sql => sql.startsWith('CREATE OR REPLACE TRIGGER log_process_queue_insert'))).toHaveLength(1)
})
