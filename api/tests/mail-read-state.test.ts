import { expect, mock, test } from 'bun:test'
const moves: unknown[][] = []
const patches: unknown[][] = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'user' }) }))
mock.module('../src/utils/mail/accounts.ts', () => ({ getMailAccess: async () => ({ username: 'mail-user', password: 'secret' }) }))
mock.module('../src/utils/mail/jmap.ts', () => ({
    ensureMailbox: async () => 'archive',
    moveMessage: async (...args: unknown[]) => { moves.push(args) },
    patchMessageKeywords: async (...args: unknown[]) => { patches.push(args) },
}))
const { default: action } = await import('../src/handlers/mail/postAction.ts')
const reply = { send: (body: unknown) => body }
test('archiving saves the read flag in the same move; explicit read uses the same flag', async () => {
    await action({ params: { id: 'unopened' }, body: { action: 'archive' } } as never, reply as never)
    expect(moves).toEqual([['mail-user', 'secret', 'unopened', 'archive', { $seen: true }]])
    await action({ params: { id: 'opened' }, body: { action: 'read' } } as never, reply as never)
    expect(patches).toEqual([['mail-user', 'secret', 'opened', { $seen: true }]])
})
