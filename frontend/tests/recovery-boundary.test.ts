import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'
let readOnly = true
mock.module('../../api/src/utils/resilience', () => ({ recoveryReadOnly: () => readOnly }))
const { proxy } = await import('../src/proxy')
const request = (method: string, path: string) => new NextRequest('https://hanasand.com' + path, { method })
assert.equal((await proxy(request('POST', '/api/cases'))).status, 503)
assert.equal((await proxy(request('POST', '/api/auth/login'))).status, 503)
assert.equal((await proxy(request('POST', '/dashboard/notes'))).status, 503, 'Server actions must also be protected')
assert.equal((await proxy(request('GET', '/api/cases'))).status, 200)
assert.equal((await proxy(request('POST', '/api/ti/search'))).status, 200)
readOnly = false
assert.equal((await proxy(request('POST', '/api/cases'))).status, 200)
console.log('Frontend recovery blocks mutations and server actions, preserves reads/search, and resumes after failback.')
