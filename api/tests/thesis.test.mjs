import { strict as assert } from 'node:assert'
import { mock, test } from 'bun:test'

mock.module('../src/utils/auth/session.ts', () => ({
    validateSession: async({ id, token }) => id === 'eirikhanasand' && token === 'synthetic-owner'
        ? { user: { id, name: 'Eirik Hanasand' } } : null,
}))
const { validThesis } = await import('../src/utils/thesis.ts')
const { putThesis, getThesisHistory } = await import('../src/handlers/thesis.ts')

test('thesis rejects unauthenticated writes and history reads', async() => {
    function reply() {
        return { statusCode: 200, status(code) { this.statusCode = code; return this }, send(value) { this.payload = value; return this } }
    }
    for (const handler of [putThesis, getThesisHistory]) {
        for (const [id, token] of [['other', 'synthetic-owner'], ['eirikhanasand', 'forged'], ['', '']]) {
            const res = reply()
            await handler({ headers: { id, authorization: 'Bearer ' + token }, log: { error() {} } }, res)
            assert.equal(res.statusCode, 403)
        }
    }
    assert.equal(validThesis({ title: '# Thesis', body: '', revision: 0 }), true)
    assert.equal(validThesis({ title: '# Thesis', body: '', revision: -1 }), false)
    assert.equal(validThesis({ title: '# Thesis', body: '' }), false)
})

test.skipIf(process.env.THESIS_TEST_DATABASE !== '1')('PostgreSQL: idempotent autosaves, conflicts, rollback, broadcasts, grouping and retention', async() => {
    // Run only against the disposable thesis-test-db container, never the production database.
    assert.equal(process.env.DB_HOST, 'thesis-test-db')
    const { queryOnce } = await import('../src/utils/db.ts')
    const { default: ensureSchema } = await import('../src/utils/db/thesisSchema.ts')
    const { saveThesis, readThesis, compactThesisHistory, subscribeThesis } = await import('../src/utils/thesis.ts')
    const { EventEmitter } = await import('node:events')
    await ensureSchema()
    await queryOnce('TRUNCATE thesis_history, thesis')
    await ensureSchema()
    const messages = []
    const socket = new EventEmitter()
    socket.readyState = 1
    socket.bufferedAmount = 0
    socket.send = (text, callback) => { messages.push(JSON.parse(text)); callback?.() }
    subscribeThesis(socket)
    let result = await saveThesis({ title: '# Thesis', body: 'First edit', revision: 0 })
    assert.equal(result.document.revision, 1)
    result = await saveThesis({ title: '# Thesis', body: 'Second edit', revision: 1 })
    assert.equal(result.document.revision, 2)
    assert.equal((await queryOnce('SELECT count(*)::int AS n FROM thesis_history')).rows[0].n, 2)
    assert.equal((await queryOnce("SELECT content FROM thesis_history WHERE id='previous'")).rows[0].content, 'First edit')
    assert.equal((await queryOnce("SELECT content FROM thesis_history WHERE id<>'previous'")).rows[0].content, '')
    assert.equal((await saveThesis({ title: '# Thesis', body: 'Second edit', revision: 0 })).changed, false)
    assert.equal((await saveThesis({ title: '# Thesis', body: 'Stale tab', revision: 0 })).status, 409)
    await assert.rejects(saveThesis({ title: '', body: 'Invalid', revision: 2 }))
    assert.equal((await readThesis()).body, 'Second edit')
    assert.equal((await queryOnce("SELECT content FROM thesis_history WHERE id='previous'")).rows[0].content, 'First edit')
    const historyReply = { statusCode: 200, status(code) { this.statusCode = code; return this }, header() { return this }, send(value) { this.payload = value; return this } }
    await getThesisHistory({ headers: { id: 'eirikhanasand', authorization: 'Bearer synthetic-owner' }, params: {}, query: {}, log: { error(e) { throw e } } }, historyReply)
    assert.equal(historyReply.statusCode, 200)
    assert.equal(historyReply.payload[0].revision, 1)
    assert.equal(messages.at(-1).revision, 2)
    await queryOnce(`
        INSERT INTO thesis_history (id,title,content,revision,saved_at)
        SELECT 'old-' || n, 'Old', '', 1000+n,
            date_trunc('day',NOW()-INTERVAL '10 days') + n * INTERVAL '20 minutes'
        FROM generate_series(0,71) n
    `)
    await queryOnce(`
        INSERT INTO thesis_history (id,title,content,revision,saved_at)
        SELECT 'recent-' || n, 'Recent', '', 2000+n,
            date_trunc('day',NOW()-INTERVAL '1 day') + n * INTERVAL '20 minutes'
        FROM generate_series(0,71) n
    `)
    await compactThesisHistory()
    assert.equal((await queryOnce("SELECT count(*)::int AS n FROM thesis_history WHERE id LIKE 'old-%'")).rows[0].n, 3)
    assert.equal((await queryOnce("SELECT count(*)::int AS n FROM thesis_history WHERE id LIKE 'recent-%'")).rows[0].n, 72)
    assert.equal((await queryOnce("SELECT count(*)::int AS n FROM thesis_history WHERE id='previous'")).rows[0].n, 1)
    const restored = await saveThesis({ title: '# Thesis', body: 'First edit', revision: 2 })
    assert.equal(restored.document.revision, 3)
    assert.equal((await queryOnce("SELECT content FROM thesis_history WHERE id='previous'")).rows[0].content, 'Second edit')
    socket.emit('close')
})

