import WebSocket from 'ws'

export function proxyModelSocket(connection: WebSocket, id: string, forwarded = false) {
    const base = process.env.AI_HEALTH_WORKER_BASE?.trim()
    if (!base) return false
    if (forwarded) {
        connection.close(1011, 'Model worker forwarding loop')
        return true
    }
    const target = new URL(`/api/client/ws/${encodeURIComponent(id)}`, base)
    target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:'
    const upstream = new WebSocket(target, { handshakeTimeout: 5000, headers: { 'x-ai-models-forwarded': '1' } })
    const pending: string[] = []
    let pendingBytes = 0
    let closed = false
    const close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        pending.length = 0
        if (connection.readyState === WebSocket.OPEN) connection.close(1011, 'Model connection closed; reconnecting')
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
    }
    const heartbeat = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) connection.ping()
        if (upstream.readyState === WebSocket.OPEN) upstream.ping()
    }, 20_000)
    heartbeat.unref()
    connection.on('message', data => {
        const text = data.toString()
        if (upstream.readyState === WebSocket.OPEN) upstream.send(text)
        else if (!closed && pendingBytes + Buffer.byteLength(text) <= 1024 * 1024) {
            pending.push(text)
            pendingBytes += Buffer.byteLength(text)
        } else close()
    })
    upstream.on('open', () => {
        for (const text of pending) upstream.send(text)
        pending.length = 0
        pendingBytes = 0
    })
    upstream.on('message', data => {
        if (connection.readyState === WebSocket.OPEN) connection.send(data.toString())
    })
    connection.on('close', close)
    connection.on('error', close)
    upstream.on('close', close)
    upstream.on('error', close)
    return true
}
