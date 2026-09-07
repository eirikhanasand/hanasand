import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'
let checked = false
mock.module('#db', () => ({
    queryOnce: async (sql: string, params: unknown[]) => {
        assert.match(sql, /domain = \$3/)
        assert.match(sql, /ORDER BY id ASC/)
        assert.equal(params[0], 42)
        assert.equal(params[2], 'selected.test')
        checked = true
        return { rows: [] }
    },
    withTransaction: () => { throw new Error('Live streams should read directly') },
}))
const { getLegacyTrafficLive } = await import('../src/handlers/traffic/legacy.ts')
const raw = Object.assign(new EventEmitter(), { writeHead: () => {}, write: () => {} })
await getLegacyTrafficLive({ query: { domain: 'selected.test', after: '42' } } as never, { hijack: () => {}, raw } as never)
await new Promise(resolve => setTimeout(resolve, 0))
raw.emit('close')
assert(checked)
console.log('PASS: stream queries use the selected domain and resume cursor in record order.')
