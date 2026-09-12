import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running tests.
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'
mock.module('../../api/src/utils/resilience', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/proxy/tokenIsValid', () => ({ default: async () => ({ valid: true, state: 'valid', servicePages: ['/db'], roles: [] }) }))
const { proxy } = await import('../src/proxy')
const request = (method: string, path: string) => new NextRequest('https://hanasand.com' + path, { method, headers: { cookie: 'id=svc_fixture; access_token=hsk_fixture' } })
assert.equal((await proxy(request('GET', '/db'))).status, 200)
assert.equal((await proxy(request('HEAD', '/db'))).status, 200)
assert.equal((await proxy(request('POST', '/db'))).status, 403)
assert.equal((await proxy(request('GET', '/management/users'))).status, 403)
assert.equal((await proxy(request('GET', '/logs'))).status, 403)
assert.equal((await proxy(request('GET', '/db/other'))).status, 403)
console.log('Service browser access is limited to the granted page and read methods.')
