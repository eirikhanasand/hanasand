import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running tests.
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'
let readOnly = true
mock.module('../../api/src/utils/recovery', () => ({ recoveryReadOnly: () => readOnly }))
const { proxy } = await import('../src/proxy')
const request = (method: string, path: string) => new NextRequest('https://hanasand.com' + path, { method })
assert.equal((await proxy(request('POST', '/api/cases'))).status, 503)
assert.equal((await proxy(request('POST', '/api/auth/login'))).status, 503)
assert.equal((await proxy(request('POST', '/dashboard/notes'))).status, 503, 'Server actions must also be protected')
assert.equal((await proxy(request('GET', '/api/cases'))).status, 200)
assert.equal((await proxy(request('POST', '/api/ti/search'))).status, 200)
for (const path of ['/api/support/chat', '/api/backend/support/tickets', '/api/backend/support/tickets/id/messages', '/api/backend/support/tickets/id/status', '/api/backend/support/tickets/id/feedback']) {
    assert.equal((await proxy(request('POST', path))).status, 200, 'The support API must enforce authentication and active placement')
}
for (const path of ['/api/support/admin', '/api/backend/support/tickets/id/delete', '/api/backend/admin/support/sessions']) {
    assert.equal((await proxy(request('POST', path))).status, 503, 'Unrelated recovery restrictions remain in force')
}
assert.equal((await proxy(request('DELETE', '/api/support/chat'))).status, 503)
readOnly = false
assert.equal((await proxy(request('POST', '/api/cases'))).status, 200)
console.log('Frontend recovery blocks mutations and server actions, preserves reads/search, and resumes after failback.')
