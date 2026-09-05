import { strict as assert } from 'node:assert'
import { mock, test } from 'bun:test'

let document = { title: '# Thesis', body: '' }
mock.module('../src/utils/db.ts', () => ({
    queryOnce: async(sql, values) => {
        if (sql.startsWith('UPDATE thesis')) document = { title: values[0], body: values[1] }
        return { rows: [document], rowCount: 1 }
    },
}))
mock.module('../src/utils/auth/session.ts', () => ({
    validateSession: async({ id, token }) => token === 'valid-owner' && id === 'eirikhanasand'
        ? { user: { id, name: 'Eirik Hanasand' } } : null,
}))
const { getThesis, putThesis } = await import('../src/handlers/thesis.ts')

test('database thesis is public, but only a validated owner ID can save', async() => {
    function reply() {
        return { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this }, header() { return this }, send(value) { this.payload = value; return this } }
    }
    const request = (id, token, body = { title: '# Updated', body: 'Database content' }) => ({
        headers: { id, authorization: 'Bearer ' + token }, body, log: { error() {} },
    })
    for (const [id, token] of [['other', 'valid-owner'], ['eirikhanasand', 'forged'], ['', '']]) {
        const res = reply()
        await putThesis(request(id, token), res)
        assert.equal(res.statusCode, 403)
    }
    const invalid = reply()
    await putThesis(request('eirikhanasand', 'valid-owner', { title: '', body: '' }), invalid)
    assert.equal(invalid.statusCode, 400)
    const saved = reply()
    await putThesis(request('eirikhanasand', 'valid-owner'), saved)
    assert.equal(saved.statusCode, 200)
    const read = reply()
    await getThesis({ log: { error() {} } }, read)
    assert.deepEqual(read.payload, { title: '# Updated', body: 'Database content' })
})

