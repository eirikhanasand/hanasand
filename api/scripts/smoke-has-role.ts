import assert from 'node:assert/strict'
import { mock } from 'bun:test'

let granted = false

mock.module('#utils/loadSQL.ts', () => ({ loadSQL: async () => 'SELECT has_role' }))
mock.module('#db', () => ({
    default: async () => ({ rows: [{ has_role: granted }], rowCount: 1 }),
}))

const { default: hasRole } = await import('../src/utils/auth/hasRole.ts')
const request = { headers: { id: 'ordinary-customer' } } as any
const response = { log: { error() {} }, status() { return this }, send(value: unknown) { return value } } as any

assert.deepEqual(await hasRole(request, response, 'system_admin'), { valid: false, error: 'Unauthorized.' })
granted = true
assert.deepEqual(await hasRole(request, response, 'system_admin'), { valid: true })

console.log('Role authorization smoke passed for denied and granted roles.')
