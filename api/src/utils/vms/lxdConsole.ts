import { StringDecoder } from 'node:string_decoder'
import { createHash } from 'node:crypto'
import WebSocket from 'ws'
import config from '#constants'
import { lxdRequest } from './lxd.ts'

export function consoleUsername(id: string) {
    const readable = id.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16) || 'user'
    return `hs-${readable}-${createHash('sha256').update(id).digest('hex').slice(0, 10)}`
}

const loginScript = `set -eu
name="$1"
marker="$2"
if getent passwd "$name" >/dev/null; then
    test "$(getent passwd "$name" | cut -d: -f5)" = "$marker" || exit 1
    test "$(id -u "$name")" -ge 1000 || exit 1
else
    useradd --create-home --shell /bin/bash --comment "$marker" -- "$name"
fi
exec runuser --login "$name"`

type ExecOperation = { metadata: { fds: Record<string, string> }; id: string }

export async function openLxdConsole(name: string, userId: string, onOutput: (data: string) => void, onExit: () => void) {
    const state = await lxdRequest<{ status: string }>(`/1.0/instances/${encodeURIComponent(name)}/state`)
    if (state.metadata.status !== 'Running') throw new Error('Start this VM before opening its console.')
    const username = consoleUsername(userId)
    const result = await lxdRequest<ExecOperation>(`/1.0/instances/${encodeURIComponent(name)}/exec`, {
        method: 'POST',
        body: {
            command: ['/bin/sh', '-c', loginScript, 'hanasand-console', username, `Hanasand-${createHash('sha256').update(userId).digest('hex')}`],
            interactive: true,
            'wait-for-websocket': true,
            environment: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
            width: 100, height: 30,
        },
    })
    const operation = `/1.0/operations/${encodeURIComponent(result.metadata.id)}`
    const decoder = new StringDecoder('utf8')
    const channels: WebSocket[] = []
    let closed = false
    const close = () => {
        if (closed) return
        closed = true
        const control = channels[1]
        if (control?.readyState === WebSocket.OPEN) control.send(JSON.stringify({ command: 'signal', signal: 15 }))
        for (const socket of channels) { if (socket.readyState === WebSocket.CONNECTING) socket.terminate(); else socket.close() }
        void lxdRequest(operation, { method: 'DELETE' }).catch(() => {})
    }
    try {
        for (const fd of ['0', 'control']) {
            const secret = result.metadata.metadata.fds[fd]
            if (!secret) throw new Error('VM console channel unavailable.')
            const socket = new WebSocket(`ws+unix://${config.lxd_socket_path}:${operation}/websocket?secret=${encodeURIComponent(secret)}`, { handshakeTimeout: 10000 })
            channels.push(socket)
            socket.on('error', () => { close(); onExit() })
            socket.on('close', () => { if (!closed) { close(); onExit() } })
            if (fd === '0') socket.on('message', data => onOutput(decoder.write(data as Buffer)))
        }
        await Promise.all(channels.map(socket => new Promise<void>((resolve, reject) => {
            socket.once('open', resolve)
            socket.once('error', reject)
            socket.once('close', () => reject(new Error('VM console disconnected.')))
        })))
        if (closed) throw new Error('VM console disconnected.')
        return {
            username,
            write: (data: string) => { if (channels[0].readyState === WebSocket.OPEN) channels[0].send(Buffer.from(data)) },
            resize: (cols: number, rows: number) => {
                if (channels[1].readyState === WebSocket.OPEN) channels[1].send(JSON.stringify({ command: 'window-resize', args: { width: String(cols), height: String(rows) } }))
            },
            close,
        }
    } catch (error) { close(); throw error }
}
