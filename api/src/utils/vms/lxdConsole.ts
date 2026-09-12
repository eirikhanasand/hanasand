import { StringDecoder } from 'node:string_decoder'
import WebSocket from 'ws'
import config from '#constants'
import { lxdRequest } from './lxd.ts'

export function consoleUsername(name: string) {
    // Match the account used by the VM SSH gateway; never derive it from the website user.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name) || ['root', 'nobody'].includes(name)) throw new Error('Invalid VM login account.')
    return name
}

export const consoleLoginScript = `set -eu
name="$1"
getent passwd "$name" >/dev/null || { echo "VM login account is missing." >&2; exit 1; }
uid="$(id -u "$name")"
test "$uid" -ge 1000 && test "$uid" -lt 65534 || exit 1
exec runuser --login "$name"`

type ExecOperation = { metadata: { fds: Record<string, string> }; id: string }

export async function openLxdConsole(name: string, onOutput: (data: string) => void, onExit: () => void) {
    const state = await lxdRequest<{ status: string }>(`/1.0/instances/${encodeURIComponent(name)}/state`, { timeout: 10000 })
    if (state.metadata.status !== 'Running') throw new Error('Start this VM before opening its console.')
    const username = consoleUsername(name)
    const result = await lxdRequest<ExecOperation>(`/1.0/instances/${encodeURIComponent(name)}/exec`, {
        method: 'POST', timeout: 10000,
        body: {
            command: ['/bin/sh', '-c', consoleLoginScript, 'hanasand-console', username],
            interactive: true,
            'wait-for-websocket': true,
            environment: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
            width: 100, height: 30,
        },
    })
    return attachConsoleChannels(result.metadata, onOutput, onExit, username)
}

// The serial console remains available while the guest agent and login shell restart.
// It is read-only here: browser input is only ever sent to the user's login shell.
export async function openLxdBootConsole(name: string, onOutput: (data: string) => void, onExit: () => void) {
    const result = await lxdRequest<ExecOperation>(`/1.0/instances/${encodeURIComponent(name)}/console`, {
        method: 'POST', timeout: 10000, body: { type: 'console', width: 100, height: 30 },
    })
    const channel = await attachConsoleChannels(result.metadata, onOutput, onExit)
    return { close: channel.close }
}

async function attachConsoleChannels(result: ExecOperation, onOutput: (data: string) => void, onExit: () => void, username?: string) {
    const operation = `/1.0/operations/${encodeURIComponent(result.id)}`
    const decoder = new StringDecoder('utf8')
    const channels: WebSocket[] = []
    let closed = false
    const close = () => {
        if (closed) return
        closed = true
        const control = channels[1]
        if (username && control?.readyState === WebSocket.OPEN) control.send(JSON.stringify({ command: 'signal', signal: 15 }))
        for (const socket of channels) { if (socket.readyState === WebSocket.CONNECTING) socket.terminate(); else socket.close() }
        void lxdRequest(operation, { method: 'DELETE' }).catch(() => {})
    }
    try {
        for (const fd of ['0', 'control']) {
            const secret = result.metadata.fds[fd]
            if (!secret) throw new Error('VM console channel unavailable.')
            const socket = new WebSocket(`ws+unix://${config.lxd_socket_path}:${operation}/websocket?secret=${encodeURIComponent(secret)}`, { handshakeTimeout: 10000 })
            channels.push(socket)
            socket.on('error', () => { if (!closed) { close(); onExit() } })
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
