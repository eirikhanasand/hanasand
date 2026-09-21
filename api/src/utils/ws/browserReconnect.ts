import { EventEmitter } from 'node:events'
import WebSocket, { type RawData } from 'ws'

// The worker owns the run; a transient viewer disconnect must not destroy it.
export class BrowserReconnect extends EventEmitter {
    readonly OPEN = WebSocket.OPEN
    private socket: WebSocket
    private token = ''
    private ended = false
    private expiry?: ReturnType<typeof setTimeout>
    private readonly snapshots = new Map<string, string>()
    private snapshotBytes = 0
    constructor(socket: WebSocket, private readonly dispose: () => void, private readonly graceMs = 120_000) {
        super()
        this.socket = socket
        this.listen(socket)
        this.expiry = setTimeout(() => this.close(1008, 'Start message required'), 15_000)
        this.expiry.unref()
    }
    get readyState() { return this.ended ? WebSocket.CLOSED : WebSocket.OPEN }
    private listen(socket: WebSocket) {
        socket.on('message', (data: RawData) => {
            if (socket !== this.socket || this.ended) return
            let payload: Record<string, unknown>
            try { payload = JSON.parse(data.toString()) } catch { return }
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
            if (payload.type === 'resume' && !this.token) { this.send(JSON.stringify({ type: 'resume_unavailable' })); this.close(); return }
            if (payload.type === 'ping') { socket.send(JSON.stringify({ type: 'pong' })); return }
            if (payload.type === 'start') clearTimeout(this.expiry)
            if (!this.token && payload.type === 'start' && typeof payload.resumeToken === 'string' && /^[a-f0-9-]{36}$/.test(payload.resumeToken)) this.token = payload.resumeToken
            this.emit('message', data)
        })
        socket.on('error', () => { socket.terminate() })
        socket.on('close', (code, reason) => {
            if (socket !== this.socket || this.ended) return
            if (!this.token) { this.close(code, reason.toString()); return }
            this.expiry = setTimeout(() => this.close(1001, 'Reconnect window expired'), this.graceMs)
            this.expiry.unref()
        })
    }
    attach(socket: WebSocket) {
        socket.once('error', () => socket.terminate())
        const deadline = setTimeout(() => socket.close(1008, 'Resume authentication required'), 10_000)
        deadline.unref()
        socket.once('close', () => clearTimeout(deadline))
        socket.once('message', (data: RawData) => {
            clearTimeout(deadline)
            let payload: Record<string, unknown>
            try { payload = JSON.parse(data.toString()) } catch { socket.close(1008); return }
            if (!payload || this.ended || !this.token || payload.type !== 'resume' || payload.resumeToken !== this.token) { socket.close(1008, 'Invalid resume token'); return }
            clearTimeout(this.expiry)
            const previous = this.socket
            this.socket = socket
            this.listen(socket)
            previous.close()
            socket.send(JSON.stringify({ type: 'reconnected' }))
            for (const message of this.snapshots.values()) socket.send(message)
        })
    }
    send(data: string | Buffer, callback?: (error?: Error) => void) {
        if (this.ended) return
        const text = data.toString()
        try {
            const payload = JSON.parse(text)
            if (['ready', 'stream_ready', 'run_time', 'frame', 'tool_capture', 'downloads', 'ended'].includes(payload.type)) {
                const key = `${payload.type}:${payload.type === 'tool_capture' ? payload.id || payload.name : ''}`
                this.snapshotBytes -= this.snapshots.get(key)?.length || 0
                this.snapshots.delete(key)
                if (text.length <= 8 * 1024 * 1024) {
                    this.snapshots.set(key, text)
                    this.snapshotBytes += text.length
                }
                while (this.snapshotBytes > 16 * 1024 * 1024 || this.snapshots.size > 32) {
                    const oldest = this.snapshots.keys().next().value!
                    this.snapshotBytes -= this.snapshots.get(oldest)!.length
                    this.snapshots.delete(oldest)
                }
            }
        } catch { /* Non-JSON messages can still be forwarded. */ }
        if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data, callback)
        else callback?.()
    }
    close(code = 1000, reason = '') {
        if (this.ended) return
        this.ended = true
        clearTimeout(this.expiry)
        this.dispose()
        this.socket.close(code === 1006 ? 1001 : code, reason)
        this.emit('close', code, Buffer.from(reason))
        this.snapshots.clear()
    }
}

const sessions = new Map<string, BrowserReconnect>()
export function resumableBrowserSocket(socket: WebSocket, id: string): WebSocket | null {
    const existing = sessions.get(id)
    if (existing) { existing.attach(socket); return null }
    const session = new BrowserReconnect(socket, () => sessions.delete(id))
    sessions.set(id, session)
    return session as unknown as WebSocket
}
