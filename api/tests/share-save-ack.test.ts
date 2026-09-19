import { expect, mock, test } from 'bun:test'
import { WebSocket } from 'ws'

const pendingUpdates = new Map()
let fail = false
let missing = false
let lookupFails = false
let lookupMissing = false
let organizationId: string | null = null
let saved = ''
mock.module('../src/plugins/ws', () => ({ pendingUpdates }))
mock.module('../src/utils/db.ts', () => ({ default: async (_sql: string, values: Array<string | null>) => {
    if (_sql === 'SELECT organization_id FROM share WHERE id = $1') {
        expect(values).toEqual(['test-share'])
        if (lookupFails) throw new Error('lookup unavailable')
        if (lookupMissing) return { rows: [] }
        return { rows: [{ organization_id: organizationId }] }
    }
    expect(_sql).toMatch(/^UPDATE share SET content = \$1/)
    expect(_sql).toContain('updated_at = NOW()')
    expect(_sql).toContain('organization_id IS NULL OR content_organization_access(organization_id, $3, TRUE)')
    expect(values.slice(1)).toEqual(['test-share', null])
    expect(_sql).not.toMatch(/\btimestamp\b/)
    if (fail) throw new Error('database unavailable')
    if (missing) return { rows: [] }
    saved = values[0] as string
    return { rows: [{ id: values[1] }] }
} }))
const { handleMessage } = await import('../src/utils/ws/handleMessage.ts')

test('share edits acknowledge persisted content, and report failed or missing saves', async () => {
    const messages: Array<{ type: string, content?: string }> = []
    const socket = { readyState: WebSocket.OPEN, send: (message: string) => messages.push(JSON.parse(message)) } as WebSocket
    const broadcasts: string[] = []
    const peer = { readyState: WebSocket.OPEN, send: (message: string) => broadcasts.push(message) } as WebSocket
    const clients = new Map([['test-share', new Set([socket, peer])]])
    const edit = (content: string) => handleMessage('test-share', socket, Buffer.from(JSON.stringify({ type: 'edit', content })), clients)
    await edit('first')
    await edit('latest')
    expect(messages).toHaveLength(0)
    await Bun.sleep(1100)
    expect(saved).toBe('latest')
    expect(messages).toEqual([{ type: 'ack', content: 'latest' }])
    fail = true
    await edit('failed')
    await Bun.sleep(1100)
    expect(messages.at(-1)?.type).toBe('error')
    expect(saved).toBe('latest')
    fail = false
    missing = true
    await edit('deleted share')
    await Bun.sleep(1100)
    expect(messages.at(-1)?.type).toBe('error')
    expect(messages.map(message => message.type)).toEqual(['ack', 'error', 'error'])
    expect(saved).toBe('latest')
    expect(pendingUpdates.size).toBe(0)
    const broadcastCount = broadcasts.length
    missing = false
    lookupFails = true
    await edit('failed lookup')
    expect(messages.map(message => message.type)).toEqual(['ack', 'error', 'error', 'error'])
    expect(saved).toBe('latest')
    expect(pendingUpdates.size).toBe(0)
    expect(broadcasts).toHaveLength(broadcastCount)
    lookupFails = false
    lookupMissing = true
    await edit('missing during lookup')
    expect(messages.map(message => message.type)).toEqual(['ack', 'error', 'error', 'error', 'error'])
    expect(saved).toBe('latest')
    expect(pendingUpdates.size).toBe(0)
    expect(broadcasts).toHaveLength(broadcastCount)
    for (const payload of ['{', JSON.stringify({ type: 'ping' }), JSON.stringify({ type: 'edit', content: null })]) {
        await handleMessage('test-share', socket, Buffer.from(payload), clients)
    }
    expect(messages).toHaveLength(5)
    expect(pendingUpdates.size).toBe(0)
    expect(broadcasts).toHaveLength(broadcastCount)
    lookupMissing = false
    organizationId = 'test-organization'
    await edit('unauthorized organization edit')
    expect(messages).toHaveLength(6)
    expect(messages.at(-1)).toEqual({ type: 'error', error: 'You do not have permission to edit this organization’s share.' })
    expect(saved).toBe('latest')
    expect(pendingUpdates.size).toBe(0)
    expect(broadcasts).toHaveLength(broadcastCount)
})
