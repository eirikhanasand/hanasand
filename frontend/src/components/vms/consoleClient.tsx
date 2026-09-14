'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export default function VmConsole({ name }: { name: string }) {
    const panel = useRef<HTMLElement>(null)
    const [nativeFullscreen, setNativeFullscreen] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [viewport, setViewport] = useState<CSSProperties>()
    const fullscreen = nativeFullscreen || expanded
    useEffect(() => {
        const changed = () => setNativeFullscreen(document.fullscreenElement === panel.current)
        document.addEventListener('fullscreenchange', changed)
        return () => document.removeEventListener('fullscreenchange', changed)
    }, [])
    useEffect(() => {
        if (!expanded) return
        // The route frame is its own stacking context below the site header.
        const frame = panel.current?.closest<HTMLElement>('[data-route-frame]')
        const previousLayer = frame?.style.zIndex || ''
        if (frame) frame.style.zIndex = '1000'
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        // The visual viewport also shrinks when a mobile keyboard opens.
        const visible = window.visualViewport
        const resize = () => setViewport({ top: visible?.offsetTop || 0, left: visible?.offsetLeft || 0, width: visible?.width || window.innerWidth, height: visible?.height || window.innerHeight })
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setExpanded(false)
            }
        }
        resize()
        visible?.addEventListener('resize', resize)
        visible?.addEventListener('scroll', resize)
        window.addEventListener('resize', resize)
        document.addEventListener('keydown', escape, true)
        return () => {
            document.body.style.overflow = previousOverflow
            if (frame) frame.style.zIndex = previousLayer
            visible?.removeEventListener('resize', resize)
            visible?.removeEventListener('scroll', resize)
            window.removeEventListener('resize', resize)
            document.removeEventListener('keydown', escape, true)
        }
    }, [expanded])
    async function toggleFullscreen() {
        if (expanded) { setExpanded(false); return }
        if (document.fullscreenElement === panel.current) {
            await document.exitFullscreen().catch(() => setStatus('Use your browser’s fullscreen control to exit.'))
            return
        }
        try {
            if (!panel.current?.requestFullscreen || document.fullscreenEnabled === false) { setExpanded(true); return }
            await panel.current.requestFullscreen()
        } catch {
            // Some mobile browsers cannot fullscreen arbitrary elements. Keep the
            // same mounted terminal and connection while filling the browser area.
            setExpanded(true)
        }
    }
    const container = useRef<HTMLDivElement>(null)
    const reconnect = useRef<() => void>(() => {})
    const bootPanel = useRef<HTMLPreElement>(null)
    const followBoot = useRef(true)
    const [bootLog, setBootLog] = useState('')
    const [bootError, setBootError] = useState('')
    const [showBoot, setShowBoot] = useState(false)
    useEffect(() => {
        if (followBoot.current && bootPanel.current) bootPanel.current.scrollTop = bootPanel.current.scrollHeight
    }, [bootLog, showBoot])
    const [status, setStatus] = useState('Connecting…')
    const [username, setUsername] = useState('')
    useEffect(() => {
        let disposed = false
        let socket: WebSocket | undefined
        let retry: ReturnType<typeof setTimeout> | undefined
        let disposeTerminal: (() => void) | undefined
        setStatus('Connecting…')
        setUsername('')
        setBootLog('')
        setBootError('')
        setShowBoot(false)
        void (async () => {
            const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
            if (disposed || !container.current) return
            const terminal = new Terminal({ cursorBlink: true, fontSize: 14, scrollback: 5000, theme: { background: '#08111f', foreground: '#e6edf3' } })
            const fit = new FitAddon()
            terminal.loadAddon(fit)
            terminal.open(container.current)
            // Safari needs a real textarea selection before opening its native Copy menu.
            const selection = terminal.onSelectionChange(() => {
                const textarea = terminal.textarea
                if (!textarea) return
                textarea.value = terminal.getSelection()
                textarea.setSelectionRange(0, textarea.value.length)
            })
            terminal.attachCustomKeyEventHandler(event => {
                const copy = event.key.toLowerCase() === 'c' && !event.altKey && (event.metaKey || (event.ctrlKey && event.shiftKey))
                if (!copy || !terminal.hasSelection()) return true
                if (event.type === 'keydown') {
                    event.preventDefault()
                    // Use the native copy event, which xterm fills with the selected text.
                    if (!document.execCommand('copy')) setStatus('Could not copy. Use the terminal’s right-click menu to try again.')
                }
                return false
            })
            let followOutput = true
            let pendingWrites = 0
            const scroll = terminal.onScroll(position => {
                if (!pendingWrites) followOutput = position >= terminal.buffer.active.baseY
            })
            const stopFollowing = (event: WheelEvent) => {
                if (event.deltaY < 0) followOutput = false
            }
            const host = container.current
            host.addEventListener('wheel', stopFollowing, { passive: true })
            let ready = false
            let failed = false
            const sendSize = () => {
                if (disposed) return
                const following = followOutput
                fit.fit()
                if (following) terminal.scrollToBottom()
                if (ready && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
            }
            const observer = new ResizeObserver(sendSize)
            observer.observe(container.current)
            const input = terminal.onData(data => {
                followOutput = true
                terminal.scrollToBottom()
                if (ready && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }))
            })
            disposeTerminal = () => { observer.disconnect(); host.removeEventListener('wheel', stopFollowing); input.dispose(); selection.dispose(); scroll.dispose(); terminal.dispose() }
            const connect = () => {
                if (disposed) return
                clearTimeout(retry)
                if (socket) { socket.onclose = null; socket.close() }
                ready = false
                failed = false
                socket = new WebSocket(`${config.url.api_wss}/vm/${encodeURIComponent(name)}/console`)
                socket.onopen = () => {
                    socket?.send(JSON.stringify({ type: 'auth', id: getCookie('id'), token: decodeURIComponent(getCookie('access_token') || '') }))
                    setStatus('Opening console…')
                }
                socket.onmessage = event => {
                    if (disposed) return
                    try {
                        const message = JSON.parse(event.data)
                        if (message.type === 'output') {
                            pendingWrites++
                            terminal.write(message.data, () => {
                                if (!disposed && followOutput) terminal.scrollToBottom()
                                pendingWrites--
                            })
                        }
                        else if (message.type === 'ready') {
                            ready = true
                            setUsername(message.username)
                            setStatus('Connected')
                            sendSize()
                            terminal.focus()
                        } else if (message.type === 'error') {
                            failed = true
                            setStatus(message.message)
                        } else if (message.type === 'status') {
                            ready = false
                            setStatus(message.message)
                            if (message.message !== 'Opening console…') setShowBoot(true)
                        } else if (message.type === 'boot-output') {
                            setBootError('')
                            setBootLog(previous => (previous + message.data).slice(-65536))
                        } else if (message.type === 'boot-error') setBootError(message.message)
                        else if (message.type === 'closed') setStatus('Console disconnected. Reconnecting…')
                    } catch { setStatus('Invalid console response. Reconnect to try again.') }
                }
                socket.onerror = () => { if (!disposed && !failed) setStatus('Connection lost. Reconnecting automatically…') }
                socket.onclose = event => {
                    ready = false
                    if (disposed || failed || event.code === 1008) return
                    setStatus('Connection lost. Reconnecting automatically…')
                    retry = setTimeout(connect, 2000)
                }
            }
            reconnect.current = connect
            connect()
        })().catch(() => { if (!disposed) setStatus('Unable to load the console. Try again.') })
        return () => { disposed = true; clearTimeout(retry); reconnect.current = () => {}; socket?.close(); disposeTerminal?.() }
    }, [name])

    return <section ref={panel} data-expanded={expanded || undefined} style={expanded ? viewport : undefined} className={`flex min-h-0 flex-col gap-3 overflow-hidden border border-ui-border bg-ui-panel p-4 [&:fullscreen]:h-dvh [&:fullscreen]:w-screen [&:fullscreen]:rounded-none ${expanded ? 'fixed inset-0 z-[1000] h-dvh rounded-none pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]' : 'h-[calc(100dvh-7rem)] rounded-xl'}`}>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='text-lg font-semibold'>{name} console</h1><p role='status' className='text-sm text-ui-muted'>{status}{username ? ` · ${username}` : ''}</p></div>
            <div className='flex items-center gap-3'>
                <button type='button' onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={fullscreen} className='rounded-lg border border-ui-border p-2'>{fullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}</button>
                <Link href='/system' className='text-sm text-ui-primary'>Back to overview</Link>
                <button type='button' onClick={() => reconnect.current()} className='flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'><RefreshCw className='h-4 w-4' />Reconnect</button>
            </div>
        </header>
        {(bootLog || bootError || showBoot) && <details open={showBoot} onToggle={event => setShowBoot(event.currentTarget.open)} className='shrink-0 rounded-lg border border-ui-border px-3 py-2 text-sm'>
            <summary className='cursor-pointer'>Restart log</summary>
            {bootError && <p className='text-ui-muted'>{bootError}</p>}
            <pre ref={bootPanel} onScroll={event => { const el = event.currentTarget; followBoot.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4 }} className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs' aria-label='VM restart log'>{bootLog || 'Waiting for boot output…'}</pre>
        </details>}
        <div ref={container} aria-label={`${name} terminal`} className='min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-[#08111f] p-2' />
    </section>
}
