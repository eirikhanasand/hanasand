import { expect, test } from 'bun:test'

process.env.DB_PASSWORD ||= 'fixture-db-password'
process.env.DB_HOST ||= '127.0.0.1'
process.env.VM_API_TOKEN = 'fixture-current-token'
process.env.VM_API_TOKEN_PREVIOUS = 'fixture-previous-token'

const { default: hasInternalToken } = await import('../src/utils/auth/internalToken.ts')

const request = (authorization: string) => ({ headers: { authorization } }) as never

test('accepts the active and previous internal token during credential rollout only', () => {
    expect(hasInternalToken(request('Bearer fixture-current-token'))).toBe(true)
    expect(hasInternalToken(request('Bearer fixture-previous-token'))).toBe(true)
    expect(hasInternalToken(request('Bearer unrelated-token'))).toBe(false)
})
