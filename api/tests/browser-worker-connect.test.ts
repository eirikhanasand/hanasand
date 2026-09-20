import { expect, test } from 'bun:test'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import { connectBrowserWorkerSocket } from '../src/utils/ws/connectBrowserWorker.ts'

async function fixture(mode: 'delay' | 'reject' | 'hang', run: (url: string, attempts: () => number) => Promise<void>) {
    let attempts = 0
    const server = http.createServer()
    const sockets = new Set<import('node:net').Socket>()
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
    const ws = new WebSocketServer({ noServer: true })
    server.on('upgrade', (request, socket, head) => {
        attempts++
        if (mode === 'hang') return
        if (mode === 'reject' || attempts < 4) { socket.end('HTTP/1.1 503 Starting\r\nConnection: close\r\n\r\n'); return }
        ws.handleUpgrade(request, socket, head, client => ws.emit('connection', client, request))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as import('node:net').AddressInfo
    try { await run(`ws://127.0.0.1:${address.port}`, () => attempts) }
    finally {
        for (const socket of sockets) socket.destroy()
        for (const client of ws.clients) client.terminate()
        ws.close()
        await new Promise<void>(resolve => server.close(() => resolve()))
    }
}

test('waits for a starting worker, then leaves the connected socket usable', async () => {
    await fixture('delay', async (url, attempts) => {
        const socket = await connectBrowserWorkerSocket(url, new AbortController().signal, 1000, 25)
        expect(attempts()).toBe(4)
        expect(socket.readyState).toBe(socket.OPEN)
        socket.close()
    })
})

for (const mode of ['reject', 'hang'] as const) {
    test(`bounds startup when the worker ${mode}s connections`, async () => {
        await fixture(mode, async url => {
            const started = Date.now()
            await expect(connectBrowserWorkerSocket(url, new AbortController().signal, 150, 20)).rejects.toThrow('did not become ready')
            expect(Date.now() - started).toBeLessThan(1000)
        })
    })
}

test('cancelling startup stops retries and closes the pending connection', async () => {
    await fixture('reject', async (url, attempts) => {
        const abort = new AbortController()
        const pending = connectBrowserWorkerSocket(url, abort.signal, 1000, 20)
        setTimeout(() => abort.abort(), 50)
        await expect(pending).rejects.toThrow('cancelled')
        const count = attempts()
        await new Promise(resolve => setTimeout(resolve, 80))
        expect(attempts()).toBe(count)
    })
})

test('an already cancelled run never opens a worker connection', async () => {
    await fixture('reject', async (url, attempts) => {
        await expect(connectBrowserWorkerSocket(url, AbortSignal.abort(), 1000, 20)).rejects.toThrow('cancelled')
        expect(attempts()).toBe(0)
    })
})
