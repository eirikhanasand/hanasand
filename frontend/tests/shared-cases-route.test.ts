import { beforeEach, expect, mock, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'

let intelligence: () => Promise<Response>
let monitoring: () => Promise<Response>
mock.module('../src/app/api/dwm/_tiProxy', () => ({ proxyTiRequest: () => intelligence() }))
mock.module('../src/app/api/cases/monitoring/route', () => ({ GET: () => monitoring() }))
const { GET } = await import('../src/app/api/cases/route')
beforeEach(() => {
    intelligence = async () => NextResponse.json({ items: [{ id: 'general', updatedAt: '2026-09-06' }], total: 60, nextCursor: 'page-2', access: { readOnly: true } })
    monitoring = async () => NextResponse.json({ items: [{ id: 'HA-3', updatedAt: '2026-09-07' }] })
})
test('common API merges persisted cases while preserving access and pagination metadata', async () => {
    const result = await (await GET(new NextRequest('http://localhost/api/cases'))).json()
    expect(result.items.map((item: { id: string }) => item.id)).toEqual(['HA-3', 'general'])
    expect(result).toMatchObject({ total: 61, nextCursor: 'page-2', access: { readOnly: true }, warnings: [] })
    const next = await (await GET(new NextRequest('http://localhost/api/cases?cursor=page-2'))).json()
    expect(next.items.map((item: { id: string }) => item.id)).toEqual(['general'])
})
test('monitoring remains available if intelligence is down, with an explicit partial error', async () => {
    intelligence = async () => { throw new Error('offline') }
    const response = await GET(new NextRequest('http://localhost/api/cases'))
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.items).toHaveLength(1)
    expect(result.warnings).toEqual(['Intelligence cases are unavailable. Retry to load them.'])
    monitoring = async () => NextResponse.json({}, { status: 503 })
    expect((await GET(new NextRequest('http://localhost/api/cases'))).status).toBe(503)
})
test('authorization errors are not presented as a successful partial list', async () => {
    intelligence = async () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const response = await GET(new NextRequest('http://localhost/api/cases'))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
})
