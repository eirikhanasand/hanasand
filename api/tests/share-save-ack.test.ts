import { expect, mock, test } from 'bun:test'
import { WebSocket } from 'ws'

const pendingUpdates = new Map()
let fail = false
let missing = false
let saved = ''
mock.module('../src/plugins/ws', () => ({ pendingUpdates }))
mock.module('../src/utils/db.ts', () => ({ default: async (_sql: string, values: string[]) => {
    expect(_sql).toContain('updated_at = NOW()')
    expect(_sql).not.toMatch(/\btimestamp\b/)
    if (fail) throw new Error('database unavailable')
    saved = values[0]
    return { rows: missing ? [] : [{ id: values[1] }] }
} }))
const { handleMessage } = await import('../src/utils/ws/handleMessage.ts')

test('share edits acknowledge persisted content, and report failed or missing saves', async () => {
    const messages: Array<{ type: string, content?: string }> = []
    const socket = { readyState: WebSocket.OPEN, send: (message: string) => messages.push(JSON.parse(message)) } as WebSocket
    const edit = (content: string) => handleMessage('test-share', socket, Buffer.from(JSON.stringify({ type: 'edit', content })), new Map())
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
    expect(pendingUpdates.size).toBe(0)
})
