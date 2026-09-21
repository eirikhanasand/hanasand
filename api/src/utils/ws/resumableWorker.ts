import { EventEmitter } from 'node:events'
import WebSocket, { type RawData } from 'ws'
import { connectBrowserWorkerSocket } from './connectBrowserWorker.ts'

// Keep the broker's worker session alive across idle timeouts and short network interruptions.
export async function connectResumableWorker(url: string, signal: AbortSignal, token: string): Promise<WebSocket> {
    const first = await connectBrowserWorkerSocket(url, signal)
    const session = new WorkerConnection(first, url, signal, token)
    return session as unknown as WebSocket
}

class WorkerConnection extends EventEmitter {
    private socket: WebSocket
    private closed = false
    private terminal = false
    private connected = true
    private pending: string[] = []
    private heartbeat: ReturnType<typeof setInterval>
    private recovery?: ReturnType<typeof setTimeout>
    private retry?: ReturnType<typeof setTimeout>
    private handshake?: ReturnType<typeof setTimeout>
    private readonly abort = () => this.close()
    constructor(first: WebSocket, private url: string, private signal: AbortSignal, private token: string) {
        super()
        this.socket = first
        this.listen(first)
        let alive = true
        this.heartbeat = setInterval(() => {
            if (!this.connected || this.closed) return
            if (!alive) { this.socket.terminate(); return }
            alive = false
            // Exercise the application path as well as the transport, even when
            // the page is idle and no new evidence is being sent.
            this.socket.send(JSON.stringify({ type: 'ping' }))
        }, 20_000)
        this.heartbeat.unref()
        this.on('pong', () => { alive = true })
        signal.addEventListener('abort', this.abort, { once: true })
    }
    get readyState() { return this.closed ? WebSocket.CLOSED : WebSocket.OPEN }
    send(data: string | Buffer) {
        if (this.closed) return
        if (this.connected && this.socket.readyState === WebSocket.OPEN) this.socket.send(data)
        else if (this.pending.length < 100) this.pending.push(data.toString())
        else this.fail('Too many queued browser commands while reconnecting.')
    }
    close() {
        if (this.closed) return
        this.closed = true
        clearInterval(this.heartbeat)
        clearTimeout(this.recovery)
        clearTimeout(this.retry)
        clearTimeout(this.handshake)
        this.signal.removeEventListener('abort', this.abort)
        this.socket.close()
        this.emit('close', 1000, Buffer.alloc(0))
    }
    private fail(message: string) {
        if (this.closed) return
        this.emit('error', new Error(message))
        this.close()
    }
    private listen(socket: WebSocket) {
        socket.on('pong', () => this.emit('pong'))
        socket.on('error', () => socket.terminate())
        socket.on('message', (data: RawData) => {
            if (this.closed || socket !== this.socket) return
            let type: string | undefined
            try { type = JSON.parse(data.toString())?.type } catch { /* Forward original payload. */ }
            this.emit('pong')
            if (type === 'pong') return
            if (type === 'resume_unavailable') { this.fail('The isolated browser worker is no longer available.'); return }
            if (type === 'reconnected') {
                this.connected = true
                clearTimeout(this.recovery); this.recovery = undefined
                clearTimeout(this.handshake)
                this.emit('pong')
                for (const command of this.pending.splice(0)) socket.send(command)
                return
            }
            if (type === 'ended') this.terminal = true
            this.emit('message', data)
        })
        socket.on('close', () => {
            if (this.closed || socket !== this.socket) return
            if (this.terminal) { this.close(); return }
            this.connected = false
            clearTimeout(this.handshake)
            this.recovery ||= setTimeout(() => this.fail('The isolated browser worker did not reconnect within one minute.'), 60_000)
            this.retry = setTimeout(() => { void this.reconnect() }, 500)
        })
    }
    private async reconnect() {
        try {
            const next = await connectBrowserWorkerSocket(this.url, this.signal, 55_000)
            if (this.closed) { next.close(); return }
            this.socket = next
            this.listen(next)
            this.handshake = setTimeout(() => next.terminate(), 10_000)
            next.send(JSON.stringify({ type: 'resume', resumeToken: this.token }))
        } catch { this.fail('Unable to reconnect to the isolated browser worker.') }
    }
}
