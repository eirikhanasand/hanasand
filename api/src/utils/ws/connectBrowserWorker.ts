import WebSocket from 'ws'

export function connectBrowserWorkerSocket(url: string, signal: AbortSignal, timeoutMs = 60_000, retryDelayMs = 500): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        let socket: WebSocket | undefined
        let retryTimer: ReturnType<typeof setTimeout> | undefined
        let settled = false
        const cleanup = () => {
            clearTimeout(deadline)
            clearTimeout(retryTimer)
            signal.removeEventListener('abort', cancel)
        }
        const fail = (message: string) => {
            if (settled) return
            settled = true
            cleanup()
            socket?.terminate()
            reject(new Error(message))
        }
        const cancel = () => fail('Browser startup cancelled.')
        // A cold streaming worker can need more than ten seconds to start X11 and its API.
        const deadline = setTimeout(() => fail(`The isolated browser did not become ready within ${timeoutMs / 1000} seconds. Try again.`), timeoutMs)
        signal.addEventListener('abort', cancel, { once: true })
        const connect = () => {
            if (signal.aborted) { cancel(); return }
            if (settled) return
            socket = new WebSocket(url, { handshakeTimeout: Math.min(2000, timeoutMs) })
            const attemptSocket = socket
            let retried = false
            const retry = () => {
                if (settled || retried) return
                retried = true
                attemptSocket.terminate()
                retryTimer = setTimeout(connect, retryDelayMs)
            }
            attemptSocket.once('open', () => {
                if (settled || retried) { attemptSocket.close(); return }
                settled = true
                cleanup()
                resolve(attemptSocket)
            })
            // Bun can emit another error when a failed handshake is terminated.
            attemptSocket.on('error', retry)
            attemptSocket.once('close', retry)
        }
        connect()
    })
}
