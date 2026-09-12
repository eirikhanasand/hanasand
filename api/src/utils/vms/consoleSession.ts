import { stripVTControlCharacters } from 'node:util'
import { lxdRequest } from './lxd.ts'
import { openLxdBootConsole, openLxdConsole } from './lxdConsole.ts'

const defaults = {
    state: async (name: string) => (await lxdRequest<{ status: string }>(`/1.0/instances/${encodeURIComponent(name)}/state`, { timeout: 10000 })).metadata.status,
    shell: openLxdConsole,
    boot: openLxdBootConsole,
}

// Keep the browser session alive across guest shutdown and agent startup. All channels
// belong to the already-authorized browser session and are closed on revocation.
export function startConsoleSession(name: string, send: (message: object) => void, dependencies = defaults, retryMs = 2000) {
    let closed = false
    let shell: Awaited<ReturnType<typeof openLxdConsole>> | undefined
    let boot: Awaited<ReturnType<typeof openLxdBootConsole>> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let connecting = false
    let bootTail = ''
    let connected = false
    let restarting = false
    let status = ''
    let cols = 100, rows = 30
    const report = (message: string) => {
        if (closed || message === status) return
        status = message
        send({ type: 'status', message })
    }
    const retry = () => { if (!closed && !timer) timer = setTimeout(() => { timer = undefined; void connect() }, retryMs) }
    const output = (data: string) => { if (!closed) send({ type: 'output', data }) }
    const bootOutput = (data: string) => {
        if (closed) return
        const text = stripVTControlCharacters(data).replace(/\r/g, '')
        send({ type: 'boot-output', data: text })
        bootTail = (bootTail + text).slice(-2000)
        if (!restarting && /reboot: Restarting system|Reached target .*Reboot|Restarting system\./i.test(bootTail)) {
            restarting = true
            report('VM is restarting…')
        }
    }
    async function connect() {
        if (closed) return
        if (connecting) { retry(); return }
        connecting = true
        try {
            const state = await dependencies.state(name)
            if (closed) return
            if (state !== 'Running') {
                report(restarting ? `VM is restarting… (${state.toLowerCase()})` : `VM is ${state.toLowerCase()}. Waiting for it to start…`)
                retry()
                return
            }
            if (!boot) {
                try {
                    let ended = false
                    const channel = await dependencies.boot(name, bootOutput, () => { ended = true; boot = undefined; retry() })
                    if (closed || ended) channel.close()
                    else boot = channel
                } catch { if (!closed) send({ type: 'boot-error', message: 'Boot log unavailable. Retrying automatically…' }) }
            }
            if (closed) return
            if (!shell) {
                report(restarting ? 'VM is restarting… Waiting for the login console.' : connected ? 'Reconnecting to the VM…' : 'Opening console…')
                let ended = false
                const channel = await dependencies.shell(name, output, () => {
                    ended = true
                    shell = undefined
                    report(restarting ? 'VM is restarting…' : 'Console disconnected. Checking VM…')
                    retry()
                })
                if (closed || ended) { channel.close(); retry(); return }
                shell = channel
                connected = true
                restarting = false
                bootTail = ''
                status = ''
                shell.resize(cols, rows)
                send({ type: 'ready', username: shell.username })
            }
            // Retry a missing serial channel without disturbing the connected shell.
            if (!boot) retry()
        } catch {
            report(restarting ? 'VM is restarting… Waiting for the login console.' : 'VM console unavailable. Retrying automatically…')
            retry()
        } finally { connecting = false }
    }
    void connect()
    return {
        write: (data: string) => shell?.write(data),
        resize: (width: number, height: number) => { cols = width; rows = height; shell?.resize(cols, rows) },
        close: () => { closed = true; clearTimeout(timer); shell?.close(); boot?.close() },
    }
}
