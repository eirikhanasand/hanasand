import { afterEach, expect, test } from 'bun:test'
import { listMessagePage } from '../src/utils/mail/jmap'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('mail pages use a stable anchor, preserve query order and expose an end cursor', async () => {
    const queries: Record<string, unknown>[] = []
    globalThis.fetch = (async (_url, init) => {
        if (!init?.body) return Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        const [method, args] = JSON.parse(String(init.body)).methodCalls[0]
        if (method === 'Email/query') {
            queries.push(args)
            return Response.json({ methodResponses: [[method, { ids: args.anchor ? ['third'] : ['first', 'second', 'third'] }, 'q']] })
        }
        return Response.json({ methodResponses: [[method, { list: args.ids.map((id: string) => ({ id })).reverse() }, 'get']] })
    }) as typeof fetch
    const first = await listMessagePage('user', 'secret', 'inbox', undefined, 2)
    expect(first.messages.map(m => m.id)).toEqual(['first', 'second'])
    expect(first.nextCursor).toBe('second')
    const last = await listMessagePage('user', 'secret', 'inbox', first.nextCursor!, 2)
    expect(last.messages.map(m => m.id)).toEqual(['third'])
    expect(last.nextCursor).toBeNull()
    expect(queries[1]).toMatchObject({ anchor: 'second', anchorOffset: 1, limit: 3, filter: { inMailbox: 'inbox' } })
})
test('a missing anchor is an error, not a false empty mailbox', async () => {
    globalThis.fetch = (async (_url, init) => !init?.body
        ? Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        : Response.json({ methodResponses: [['error', { type: 'anchorNotFound' }, 'q']] })) as typeof fetch
    await expect(listMessagePage('user', 'secret', 'inbox', 'deleted')).rejects.toThrow('Mail request failed')
})
