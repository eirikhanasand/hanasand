'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export default function VmConsole({ name }: { name: string }) {
    const container = useRef<HTMLDivElement>(null)
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState('Connecting…')
    const [username, setUsername] = useState('')
    useEffect(() => {
        let disposed = false
        let socket: WebSocket | undefined
        let disposeTerminal: (() => void) | undefined
        setStatus('Connecting…')
        setUsername('')
        void (async () => {
            const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
            if (disposed || !container.current) return
            const terminal = new Terminal({ cursorBlink: true, fontSize: 14, scrollback: 5000, theme: { background: '#08111f', foreground: '#e6edf3' } })
            const fit = new FitAddon()
            terminal.loadAddon(fit)
            terminal.open(container.current)
            let ready = false
            let failed = false
            const sendSize = () => {
                if (disposed) return
                fit.fit()
                if (ready && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
            }
            const observer = new ResizeObserver(sendSize)
            observer.observe(container.current)
            const input = terminal.onData(data => {
                if (ready && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }))
            })
            disposeTerminal = () => { observer.disconnect(); input.dispose(); terminal.dispose() }
            socket = new WebSocket(`${config.url.api_wss}/vm/${encodeURIComponent(name)}/console`)
            socket.onopen = () => {
                socket?.send(JSON.stringify({ type: 'auth', id: getCookie('id'), token: decodeURIComponent(getCookie('access_token') || '') }))
                setStatus('Opening console…')
            }
            socket.onmessage = event => {
                if (disposed) return
                try {
                    const message = JSON.parse(event.data)
                    if (message.type === 'output') terminal.write(message.data)
                    else if (message.type === 'ready') {
                        ready = true
                        setUsername(message.username)
                        setStatus('Connected')
                        sendSize()
                        terminal.focus()
                    } else if (message.type === 'error') {
                        failed = true
                        setStatus(message.message)
                    } else if (message.type === 'closed') setStatus('Console closed.')
                } catch { setStatus('Invalid console response. Reconnect to try again.') }
            }
            socket.onerror = () => { failed = true; if (!disposed) setStatus('Unable to connect to the console.') }
            socket.onclose = () => { ready = false; if (!disposed && !failed) setStatus('Console closed.') }
        })().catch(() => { if (!disposed) setStatus('Unable to load the console. Try again.') })
        return () => { disposed = true; socket?.close(); disposeTerminal?.() }
    }, [name, attempt])

    return <section className='flex min-h-[65vh] flex-col gap-3 rounded-xl border border-ui-border bg-ui-panel p-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='text-lg font-semibold'>{name} console</h1><p role='status' className='text-sm text-ui-muted'>{status}{username ? ` · ${username}` : ''}</p></div>
            <div className='flex items-center gap-3'>
                <Link href='/system' className='text-sm text-ui-primary'>Back to overview</Link>
                <button type='button' onClick={() => setAttempt(value => value + 1)} className='flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'><RefreshCw className='h-4 w-4' />Reconnect</button>
            </div>
        </header>
        <div ref={container} aria-label={`${name} terminal`} className='min-h-96 min-w-0 flex-1 overflow-hidden rounded-lg bg-[#08111f] p-2' />
    </section>
}
