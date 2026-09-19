import { afterAll, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { GET, POST } from '../src/app/api/support/chat/route'

const originalFetch = globalThis.fetch
const tokens: string[] = []
globalThis.fetch = (async (_url: unknown, options?: RequestInit) => {
    tokens.push(new Headers(options?.headers).get('x-support-session') || '')
    return Response.json({ channel: 'ai', pending: false, status: 'open', messages: [] })
}) as typeof fetch
afterAll(() => { globalThis.fetch = originalFetch })

test('support keeps its bearer token HttpOnly and reuses it without exposing it in JSON', async () => {
    const first = await GET(new NextRequest('https://hanasand.com/api/support/chat'))
    const cookie = first.cookies.get('hanasand_support_session')!
    expect(cookie.value).toMatch(/^[a-f0-9]{64}$/)
    expect(first.headers.get('set-cookie')).toContain('HttpOnly')
    expect(first.headers.get('set-cookie')).toContain('Secure')
    expect(first.headers.get('cache-control')).toBe('no-store')
    expect(await first.text()).not.toContain(cookie.value)
    await POST(new NextRequest('https://hanasand.com/api/support/chat', { method: 'POST', headers: { host: 'hanasand.com', origin: 'https://hanasand.com', cookie: `hanasand_support_session=${cookie.value}` }, body: '{}' }))
    expect(tokens.slice(-2)).toEqual([cookie.value, cookie.value])
})

test('cross-site and malformed origins cannot post to support', async () => {
    const before = tokens.length
    for (const origin of ['https://other.example', 'not a URL', '']) {
        const response = await POST(new NextRequest('https://hanasand.com/api/support/chat', { method: 'POST', headers: { host: 'hanasand.com', origin }, body: '{}' }))
        expect(response.status).toBe(403)
    }
    expect(tokens.length).toBe(before)
})
