// Keep the run and its video alive while the control connection recovers.
export class BrowserControlSocket {
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onreconnecting: (() => void) | null = null
    private socket!: WebSocket
    private stopped = false
    private opened = false
    private disconnectedAt = 0
    private attempt = 0
    private retry?: ReturnType<typeof setTimeout>
    private heartbeat?: ReturnType<typeof setInterval>
    private lastPong = Date.now()
    constructor(private readonly url: string, private readonly token: string) { this.connect() }
    get readyState() { return this.socket.readyState }
    send(data: string) { if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data) }
    close() {
        this.stopped = true
        clearTimeout(this.retry)
        clearInterval(this.heartbeat)
        this.socket.close()
    }
    private connect() {
        if (this.stopped) return
        const socket = this.socket = new WebSocket(this.url)
        const schedule = () => {
            if (this.stopped || socket !== this.socket || this.retry) return
            clearInterval(this.heartbeat)
            this.disconnectedAt ||= Date.now()
            if (Date.now() - this.disconnectedAt >= 120_000) { this.close(); this.onclose?.(); return }
            this.onreconnecting?.()
            this.retry = setTimeout(() => { this.retry = undefined; this.connect() }, Math.min(500 * 2 ** this.attempt++, 5000))
        }
        const connecting = setTimeout(() => { socket.close(); schedule() }, 10_000)
        socket.onopen = () => {
            clearTimeout(connecting)
            if (this.stopped || socket !== this.socket) { socket.close(); return }
            this.lastPong = Date.now()
            if (this.opened) socket.send(JSON.stringify({ type: 'resume', resumeToken: this.token }))
            else { this.opened = true; this.onopen?.() }
            this.heartbeat = setInterval(() => {
                if (Date.now() - this.lastPong > 30_000) { socket.close(); schedule(); return }
                this.send(JSON.stringify({ type: 'ping' }))
            }, 10_000)
        }
        socket.onmessage = event => {
            if (socket !== this.socket || this.stopped) return
            let payload: { type?: string }
            try { payload = JSON.parse(event.data) } catch { return }
            this.lastPong = Date.now()
            if (payload.type === 'pong') return
            if (payload.type === 'reconnected' || payload.type === 'ready') { this.disconnectedAt = 0; this.attempt = 0 }
            if (payload.type === 'ended' || payload.type === 'resume_unavailable') this.close()
            this.onmessage?.(event)
        }
        socket.onerror = () => { /* onclose or heartbeat drives reconnection. */ }
        socket.onclose = () => { clearTimeout(connecting); schedule() }
    }
}
