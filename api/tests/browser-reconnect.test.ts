import { expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { BrowserReconnect } from '../src/utils/ws/browserReconnect.ts'
class Socket extends EventEmitter {
    readyState = WebSocket.OPEN
    sent: string[] = []
    send(data: string) { this.sent.push(data.toString()) }
    close() { this.readyState = WebSocket.CLOSED; this.emit('close', 1000, Buffer.alloc(0)) }
    terminate() { this.close() }
    message(value: unknown) { this.emit('message', Buffer.from(JSON.stringify(value))) }
}
const token = '12345678-1234-1234-1234-123456789abc'
test('disconnect retains the worker, rejects hijacking, then replays evidence on authenticated resume', () => {
    const first = new Socket()
    let disposed = 0, closed = 0
    const session = new BrowserReconnect(first as unknown as WebSocket, () => disposed++)
    session.on('close', () => closed++)
    first.message(null)
    first.message({ type: 'start', resumeToken: token })
    session.send(JSON.stringify({ type: 'stream_ready', streamUrl: '/stream' }))
    first.close()
    session.send(JSON.stringify({ type: 'frame', image: 'latest' }))
    expect(closed).toBe(0)
    const attacker = new Socket()
    session.attach(attacker as unknown as WebSocket)
    attacker.message({ type: 'resume', resumeToken: 'wrong' })
    expect(attacker.readyState).toBe(WebSocket.CLOSED)
    expect(attacker.sent).toEqual([])
    const second = new Socket()
    session.attach(second as unknown as WebSocket)
    second.message({ type: 'resume', resumeToken: token })
    expect(second.sent.map(text => JSON.parse(text).type)).toEqual(['reconnected', 'stream_ready', 'frame'])
    second.message({ type: 'ping' })
    expect(JSON.parse(second.sent.at(-1)!).type).toBe('pong')
    session.close()
    expect(disposed).toBe(1)
    expect(closed).toBe(1)
})
test('an abandoned disconnected session eventually releases its worker', async () => {
    const socket = new Socket()
    let disposed = 0
    const session = new BrowserReconnect(socket as unknown as WebSocket, () => disposed++, 10)
    socket.message({ type: 'start', resumeToken: token })
    socket.close()
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(disposed).toBe(1)
    expect(session.readyState).toBe(WebSocket.CLOSED)
})
