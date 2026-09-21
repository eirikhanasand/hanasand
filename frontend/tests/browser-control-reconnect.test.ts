import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('control reconnect resumes once, retains messages and stops retrying after end', () => {
    const source = new Bun.Transpiler({ loader: 'ts' }).transformSync(readFileSync(new URL('../src/app/browser/controlSocket.ts', import.meta.url), 'utf8')).replace('export class', 'class')
    const sockets: FakeSocket[] = []
    const timers = new Map<number, () => void>()
    let nextTimer = 0
    class FakeSocket {
        static OPEN = 1
        readyState = 0
        sent: string[] = []
        onopen?: () => void
        onclose?: () => void
        onmessage?: (event: { data: string }) => void
        constructor() { sockets.push(this) }
        send(data: string) { this.sent.push(data) }
        close() { this.readyState = 3; this.onclose?.() }
        open() { this.readyState = 1; this.onopen?.() }
        message(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }) }
    }
    const client = runInNewContext(source + '\nnew BrowserControlSocket("wss://test", "token")', {
        WebSocket: FakeSocket, Date,
        setTimeout: (fn: () => void) => { timers.set(++nextTimer, fn); return nextTimer },
        clearTimeout: (id: number) => timers.delete(id),
        setInterval: () => 0, clearInterval: () => {},
    })
    let starts = 0, reconnecting = 0
    client.onopen = () => { starts++ }
    client.onreconnecting = () => { reconnecting++ }
    const received: string[] = []
    client.onmessage = (event: { data: string }) => received.push(JSON.parse(event.data).type)
    sockets[0].open()
    sockets[0].close()
    expect(reconnecting).toBe(1)
    const retry = timers.values().next().value!
    timers.clear(); retry()
    sockets[1].open()
    expect(starts).toBe(1)
    expect(JSON.parse(sockets[1].sent[0])).toEqual({ type: 'resume', resumeToken: 'token' })
    sockets[1].message({ type: 'reconnected' })
    sockets[1].message({ type: 'frame' })
    sockets[1].message({ type: 'ended' })
    expect(received).toEqual(['reconnected', 'frame', 'ended'])
    expect(timers.size).toBe(0)
    expect(sockets.length).toBe(2)
})
