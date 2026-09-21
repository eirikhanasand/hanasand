import { expect, test } from 'bun:test'
import { WebSocketServer, type WebSocket } from 'ws'
import { BrowserReconnect } from '../src/utils/ws/browserReconnect.ts'
import { connectResumableWorker } from '../src/utils/ws/resumableWorker.ts'

test('broker resumes the same worker after transport loss and replays evidence', async () => {
    const server = new WebSocketServer({ port: 0 })
    await new Promise<void>(resolve => server.once('listening', resolve))
    const port = (server.address() as { port: number }).port
    const abort = new AbortController()
    let session: BrowserReconnect | undefined
    let physical: WebSocket
    let starts = 0, closes = 0
    server.on('connection', socket => {
        physical = socket
        if (session) { session.attach(socket); return }
        session = new BrowserReconnect(socket, () => {})
        session.on('close', () => { closes++ })
        session.on('message', data => {
            const p = JSON.parse(data.toString())
            if (p.type === 'start') { starts++; session!.send(JSON.stringify({ type: 'frame', image: 'same-browser' })) }
            if (p.type === 'end') { session!.send(JSON.stringify({ type: 'ended' })); session!.close() }
        })
    })
    const client = await connectResumableWorker(`ws://127.0.0.1:${port}`, abort.signal, '12345678-1234-1234-1234-123456789abc')
    const frames: unknown[] = []
    const errors: unknown[] = []
    client.on('error', error => errors.push(error))
    client.on('message', data => { if (JSON.parse(data.toString()).type === 'frame') frames.push(data) })
    client.send(JSON.stringify({ type: 'start', resumeToken: '12345678-1234-1234-1234-123456789abc' }))
    try {
        await until(() => frames.length === 1)
        physical!.terminate()
        await until(() => frames.length === 2)
        expect(starts).toBe(1)
        expect(closes).toBe(0)
        expect(errors).toEqual([])
        client.send(JSON.stringify({ type: 'end' }))
        await until(() => closes === 1)
    } finally {
        client.close(); abort.abort(); session?.close()
        for (const socket of server.clients) socket.terminate()
        server.close()
    }
}, 5000)
async function until(check: () => boolean) {
    const end = Date.now() + 3000
    while (!check()) { if (Date.now() > end) throw new Error('Timed out'); await new Promise(resolve => setTimeout(resolve, 10)) }
}
