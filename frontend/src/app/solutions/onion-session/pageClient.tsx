'use client'

import { Check, Clipboard, ClipboardPaste, Expand, Monitor, Play, RefreshCw, Square } from 'lucide-react'
import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'

type SessionState = 'idle' | 'connecting' | 'live' | 'ended'
type SocketState = 'not-configured' | 'closed' | 'connecting' | 'open' | 'error'
type BrokerFrame = {
    image: string
    width: number
    height: number
}

const sessionLengths = [10, 15, 30, 60]
const brokerBaseUrl = process.env.NEXT_PUBLIC_ONION_SESSION_WS || `${config.url.api_client_wss}/ws/onion-session`

function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return 'http://sample-intel-source.onion'
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `http://${trimmed}`
}

function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
}

function sessionId() {
    return `tor-${Date.now().toString(36)}`
}

function brokerUrlForSession(baseUrl: string, id: string) {
    if (!baseUrl) return ''
    if (baseUrl.includes(':id')) return baseUrl.replace(':id', encodeURIComponent(id))
    return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`
}

export default function OnionSessionPageClient() {
    const [target, setTarget] = useState('http://sample-intel-source.onion')
    const [sessionMinutes, setSessionMinutes] = useState(15)
    const [sessionState, setSessionState] = useState<SessionState>('idle')
    const [remainingSeconds, setRemainingSeconds] = useState(sessionMinutes * 60)
    const [activeSessionId, setActiveSessionId] = useState('pending')
    const [socketState, setSocketState] = useState<SocketState>(brokerBaseUrl ? 'closed' : 'not-configured')
    const [readOnly, setReadOnly] = useState(false)
    const [clipboardText, setClipboardText] = useState('')
    const [clipboardEnabled, setClipboardEnabled] = useState(false)
    const [clipboardStatus, setClipboardStatus] = useState('Clipboard access not requested')
    const [events, setEvents] = useState<string[]>(['Remote desktop client loaded.'])
    const [mounted, setMounted] = useState(false)
    const [remoteFrame, setRemoteFrame] = useState<BrokerFrame | null>(null)
    const socketRef = useRef<WebSocket | null>(null)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const progress = Math.max(0, Math.min(100, (remainingSeconds / (sessionMinutes * 60)) * 100))

    const pushEvent = useCallback((event: string) => {
        setEvents((current) => [event, ...current].slice(0, 8))
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (sessionState === 'idle' || sessionState === 'ended') {
            setRemainingSeconds(sessionMinutes * 60)
        }
    }, [sessionMinutes, sessionState])

    useEffect(() => {
        if (sessionState !== 'live') return
        const interval = window.setInterval(() => {
            setRemainingSeconds((current) => {
                if (current <= 1) {
                    window.clearInterval(interval)
                    setSessionState('ended')
                    pushEvent('Session expired and the remote desktop was closed.')
                    return 0
                }
                return current - 1
            })
        }, 1000)

        return () => window.clearInterval(interval)
    }, [pushEvent, sessionState])

    useEffect(() => {
        return () => {
            socketRef.current?.close()
            socketRef.current = null
        }
    }, [])

    const sendBrokerEvent = useCallback((payload: Record<string, unknown>) => {
        const socket = socketRef.current
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload))
        }
    }, [])

    const startSession = useCallback(() => {
        const targetInput = document.querySelector<HTMLInputElement>('[data-onion-target-input]')
        const startTarget = normalizeTarget(targetInput?.value || target)
        const id = sessionId()
        setActiveSessionId(id)
        setTarget(startTarget)
        setRemainingSeconds(sessionMinutes * 60)
        setSessionState('connecting')
        pushEvent(`Opening Tor Browser for ${startTarget}.`)

        const url = brokerUrlForSession(brokerBaseUrl, id)

        if (url) {
            socketRef.current?.close()
            setSocketState('connecting')
            const socket = new WebSocket(url)
            socketRef.current = socket
            socket.onopen = () => {
                setSocketState('open')
                pushEvent('Remote desktop broker attached.')
                socket.send(JSON.stringify({
                    type: 'start',
                    sessionId: id,
                    network: 'tor',
                    target: startTarget,
                    durationMinutes: sessionMinutes,
                    inputMode: readOnly ? 'view-only' : 'interactive',
                }))
            }
            socket.onclose = () => {
                setSocketState('closed')
                pushEvent('Remote desktop broker closed.')
            }
            socket.onerror = () => {
                setSocketState('error')
                setSessionState('live')
                pushEvent('Broker websocket errored; local viewport remains interactive.')
            }
            socket.onmessage = (message) => {
                if (typeof message.data !== 'string') {
                    pushEvent('Broker sent binary frame.')
                    return
                }
                try {
                    const payload = JSON.parse(message.data) as Record<string, unknown>
                    if (payload.type === 'ready') {
                        setSessionState('live')
                        pushEvent('Remote Tor browser is live.')
                        return
                    }
                    if (payload.type === 'frame' && typeof payload.image === 'string') {
                        setSessionState('live')
                        setRemoteFrame({
                            image: `data:image/jpeg;base64,${payload.image}`,
                            width: typeof payload.width === 'number' ? payload.width : 1280,
                            height: typeof payload.height === 'number' ? payload.height : 760,
                        })
                        return
                    }
                    if (payload.type === 'status' || payload.type === 'navigation_error' || payload.type === 'error') {
                        pushEvent(String(payload.message || payload.state || payload.type))
                        return
                    }
                    if (payload.type === 'clipboard') {
                        if (payload.direction === 'remote-to-browser' && typeof payload.text === 'string') {
                            setClipboardText(payload.text)
                            void navigator.clipboard.writeText(payload.text).catch(() => undefined)
                            setClipboardStatus('Remote clipboard copied locally')
                            pushEvent('Remote clipboard copied locally.')
                            return
                        }
                        setClipboardStatus('Clipboard synced to remote browser')
                        pushEvent('Clipboard synced to remote browser.')
                        return
                    }
                    if (payload.type === 'console') {
                        pushEvent(`Remote console: ${String(payload.text || 'message')}`)
                        return
                    }
                    pushEvent(`Broker: ${String(payload.type || 'message')}`)
                } catch {
                    pushEvent(`Broker: ${message.data.slice(0, 96)}`)
                }
            }
            return
        }

        window.setTimeout(() => {
            setSessionState('live')
            pushEvent('Interactive viewport ready. Remote broker is not attached in this environment.')
        }, 700)
    }, [pushEvent, readOnly, sessionMinutes, target])

    const endSession = useCallback(() => {
        socketRef.current?.send(JSON.stringify({ type: 'end', sessionId: activeSessionId }))
        socketRef.current?.close()
        socketRef.current = null
        setSessionState('ended')
        setSocketState(brokerBaseUrl ? 'closed' : 'not-configured')
        setRemoteFrame(null)
        setRemainingSeconds(0)
        pushEvent('Session ended.')
    }, [activeSessionId, pushEvent])

    const resetSession = useCallback(() => {
        socketRef.current?.close()
        socketRef.current = null
        setActiveSessionId('pending')
        setSessionState('idle')
        setSocketState(brokerBaseUrl ? 'closed' : 'not-configured')
        setRemoteFrame(null)
        setRemainingSeconds(sessionMinutes * 60)
        pushEvent('Session reset.')
    }, [pushEvent, sessionMinutes])

    const requestClipboardAccess = useCallback(async () => {
        if (!navigator.clipboard) {
            setClipboardStatus('Clipboard API unavailable in this browser')
            pushEvent('Clipboard API is unavailable in this browser.')
            return false
        }
        try {
            const permissions = navigator.permissions
            if (permissions?.query) {
                await permissions.query({ name: 'clipboard-read' as PermissionName }).catch(() => undefined)
                await permissions.query({ name: 'clipboard-write' as PermissionName }).catch(() => undefined)
            }
            const currentText = await navigator.clipboard.readText().catch(() => '')
            if (currentText) {
                setClipboardText(currentText)
                sendBrokerEvent({ type: 'clipboard', direction: 'browser-to-remote', text: currentText })
            }
            await navigator.clipboard.writeText(currentText || clipboardText || normalizedTarget).catch(() => undefined)
            setClipboardEnabled(true)
            setClipboardStatus('Clipboard ready: copy and paste directly in the viewport')
            pushEvent('Clipboard access enabled.')
            return true
        } catch {
            setClipboardEnabled(false)
            setClipboardStatus('Clipboard access blocked by browser permissions')
            pushEvent('Clipboard access was blocked by browser permissions.')
            return false
        }
    }, [clipboardText, normalizedTarget, pushEvent, sendBrokerEvent])

    const syncLocalClipboardToRemote = useCallback(async (source: 'button' | 'paste' | 'shortcut' = 'button') => {
        const text = source === 'paste' ? clipboardText : await navigator.clipboard?.readText?.().catch(() => '') || clipboardText
        if (!text) {
            setClipboardStatus('Local clipboard is empty or unavailable')
            pushEvent('Local clipboard is empty or unavailable.')
            return false
        }
        setClipboardText(text)
        sendBrokerEvent({ type: 'clipboard', direction: 'browser-to-remote', text })
        setClipboardStatus('Clipboard synced to remote browser')
        pushEvent('Clipboard synced to remote browser.')
        return true
    }, [clipboardText, pushEvent, sendBrokerEvent])

    const copySessionUrl = useCallback(async () => {
        await navigator.clipboard.writeText(normalizedTarget)
        setClipboardText(normalizedTarget)
        sendBrokerEvent({ type: 'clipboard', direction: 'browser-to-remote', text: normalizedTarget })
        setClipboardStatus('Target URL copied and synced')
        pushEvent('Target URL copied and synced.')
    }, [normalizedTarget, pushEvent, sendBrokerEvent])

    const pasteFromClipboard = useCallback(async () => {
        const ok = await syncLocalClipboardToRemote('button')
        if (ok) sendBrokerEvent({ type: 'key', key: 'v', ctrlKey: true })
    }, [sendBrokerEvent, syncLocalClipboardToRemote])

    const requestFullscreen = useCallback(() => {
        const element = document.getElementById('tor-remote-desktop')
        void element?.requestFullscreen?.()
    }, [])

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const action = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-onion-action]')?.dataset.onionAction
            if (!action) return
            event.preventDefault()
            if (action === 'start') startSession()
            if (action === 'end') endSession()
            if (action === 'reset') resetSession()
            if (action === 'copy-url') void copySessionUrl()
            if (action === 'paste') void pasteFromClipboard()
            if (action === 'enable-clipboard') void requestClipboardAccess()
            if (action === 'fullscreen') requestFullscreen()
            if (action === 'pull-clipboard') {
                sendBrokerEvent({ type: 'clipboard', direction: 'remote-to-browser' })
                setClipboardStatus('Requested remote clipboard')
                pushEvent('Requested remote clipboard.')
            }
        }
        const handleInput = (event: Event) => {
            const input = (event.target as HTMLElement | null)?.closest<HTMLInputElement>('[data-onion-target-input]')
            if (input) setTarget(input.value)
        }

        document.addEventListener('click', handleClick)
        document.addEventListener('input', handleInput)
        return () => {
            document.removeEventListener('click', handleClick)
            document.removeEventListener('input', handleInput)
        }
    }, [copySessionUrl, endSession, pasteFromClipboard, pushEvent, requestClipboardAccess, requestFullscreen, resetSession, sendBrokerEvent, startSession])

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='grid min-h-[calc(100vh-4.5rem)] grid-rows-[auto_minmax(0,1fr)]'>
                <header className='border-b border-ui-border bg-ui-panel px-4 py-4'>
                    <div className='mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3'>
                        <div className='flex min-w-0 items-center gap-3'>
                            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ui-border bg-ui-raised text-ui-primary'>
                                <Monitor className='h-5 w-5' />
                            </span>
                            <div className='min-w-0'>
                                <h1 className='truncate text-lg font-semibold text-ui-text'>Remote Tor Browser</h1>
                                <p className='truncate text-sm text-ui-muted'>Disposable remote browser for approved dark-web source review.</p>
                            </div>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusPill label='Session' value={sessionState} tone={sessionState === 'live' ? 'good' : sessionState === 'connecting' ? 'wait' : 'neutral'} />
                            <StatusPill label='Broker' value={socketState} tone={socketState === 'open' ? 'good' : socketState === 'error' || socketState === 'not-configured' ? 'warn' : 'neutral'} />
                            <StatusPill label='Time' value={formatTime(remainingSeconds)} tone='neutral' />
                        </div>
                    </div>
                </header>

                <div className='mx-auto min-h-0 w-full max-w-[96rem] px-4 py-4'>
                    <section id='tor-remote-desktop' className='grid min-h-[calc(100vh-12rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                        <div className='flex flex-wrap items-center gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'>
                            <span className='h-3 w-3 rounded-full bg-ui-danger' />
                            <span className='h-3 w-3 rounded-full bg-ui-warning' />
                            <span className='h-3 w-3 rounded-full bg-ui-success' />
                            <input
                                data-onion-target-input
                                value={target}
                                onChange={(event) => setTarget(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        const next = normalizeTarget(event.currentTarget.value)
                                        setTarget(next)
                                        if (sessionState === 'live') {
                                            sendBrokerEvent({ type: 'navigate', target: next })
                                            pushEvent(`Navigate requested: ${next}`)
                                        }
                                    }
                                }}
                                aria-label='Remote browser target URL'
                                className='h-9 min-w-56 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                            />
                            {sessionState === 'live' ? (
                                <button type='button' data-onion-action='end' className='inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ui-danger/30 bg-ui-danger/15 px-3 text-sm font-semibold text-ui-danger'>
                                    <Square className='h-4 w-4' />
                                    End
                                </button>
                            ) : (
                                <button type='button' data-onion-action='start' disabled={!mounted || sessionState === 'connecting'} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70'>
                                    <Play className='h-4 w-4' />
                                    {mounted ? 'Start' : 'Loading'}
                                </button>
                            )}
                            <button type='button' data-onion-action='reset' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Reset remote browser'>
                                <RefreshCw className='h-4 w-4' />
                            </button>
                            <button type='button' data-onion-action='enable-clipboard' className={`inline-flex h-8 items-center gap-2 rounded-md border px-2 text-xs font-semibold transition ${clipboardEnabled ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-border text-ui-text hover:border-ui-primary'}`}>
                                {clipboardEnabled ? <Check className='h-3.5 w-3.5' /> : <Clipboard className='h-3.5 w-3.5' />}
                                Clipboard
                            </button>
                            <button type='button' data-onion-action='paste' className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                <ClipboardPaste className='h-3.5 w-3.5' />
                                Paste
                            </button>
                            <button type='button' data-onion-action='pull-clipboard' className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                <Clipboard className='h-3.5 w-3.5' />
                                Copy out
                            </button>
                            <button type='button' data-onion-action='fullscreen' className='grid h-8 w-8 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Fullscreen remote browser'>
                                <Expand className='h-3.5 w-3.5' />
                            </button>
                        </div>

                        <RemoteDesktopViewport
                            target={normalizedTarget}
                            sessionState={sessionState}
                            readOnly={readOnly}
                            remaining={remainingSeconds}
                            onNavigate={(nextTarget) => {
                                const next = normalizeTarget(nextTarget)
                                setTarget(next)
                                sendBrokerEvent({ type: 'navigate', target: next })
                                pushEvent(`Navigate requested: ${next}`)
                            }}
                            onInput={(input) => sendBrokerEvent(input)}
                            onEvent={pushEvent}
                            remoteFrame={remoteFrame}
                            onLocalPaste={(text) => {
                                setClipboardText(text)
                                sendBrokerEvent({ type: 'clipboard', direction: 'browser-to-remote', text })
                                sendBrokerEvent({ type: 'key', key: 'v', ctrlKey: true })
                                setClipboardStatus('Clipboard pasted into remote browser')
                                pushEvent('Clipboard pasted into remote browser.')
                            }}
                            onLocalCopyRequest={() => {
                                sendBrokerEvent({ type: 'key', key: 'c', ctrlKey: true })
                                sendBrokerEvent({ type: 'clipboard', direction: 'remote-to-browser' })
                                setClipboardStatus('Requested remote selection')
                                pushEvent('Requested remote selection.')
                            }}
                        />

                        <div className='border-t border-ui-border bg-ui-raised px-3 py-2'>
                            <div className='mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-ui-muted'>
                                <div className='flex flex-wrap items-center gap-3'>
                                    <label className='inline-flex items-center gap-2 text-ui-text'>
                                        <input type='checkbox' checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} className='h-4 w-4 accent-ui-primary' />
                                        View only
                                    </label>
                                    <select
                                        value={sessionMinutes}
                                        onChange={(event) => setSessionMinutes(Number(event.target.value))}
                                        className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm font-semibold text-ui-text outline-none'
                                        aria-label='Session length'
                                    >
                                        {sessionLengths.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                                    </select>
                                    <span>{clipboardStatus}</span>
                                </div>
                                <div className='min-w-0 truncate font-mono'>Latest: {events[0]}</div>
                            </div>
                            <div className='h-2 overflow-hidden rounded-full bg-ui-panel'>
                                <div className='h-full rounded-full bg-ui-success transition-all duration-500' style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    )
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'good' | 'wait' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'good'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : tone === 'wait'
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : tone === 'warn'
                ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                : 'border-ui-border bg-ui-panel text-ui-text'
    return <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${toneClass}`}><span className='text-ui-muted'>{label}</span>{value}</span>
}

function RemoteDesktopViewport({
    target,
    sessionState,
    readOnly,
    remaining,
    onNavigate,
    onInput,
    onEvent,
    remoteFrame,
    onLocalPaste,
    onLocalCopyRequest,
}: {
    target: string
    sessionState: SessionState
    readOnly: boolean
    remaining: number
    onNavigate: (target: string) => void
    onInput: (payload: Record<string, unknown>) => void
    onEvent: (event: string) => void
    remoteFrame: BrokerFrame | null
    onLocalPaste: (text: string) => void
    onLocalCopyRequest: () => void
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [cursor, setCursor] = useState({ x: 620, y: 310 })
    const [addressDraft, setAddressDraft] = useState(target)
    const [focused, setFocused] = useState(false)
    const [clicks, setClicks] = useState(0)

    useEffect(() => setAddressDraft(target), [target])

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !container || !context) return

        const dpr = window.devicePixelRatio || 1
        const rect = container.getBoundingClientRect()
        const width = Math.max(760, Math.floor(canvas.clientWidth || rect.width))
        const height = Math.max(480, Math.floor(canvas.clientHeight || rect.height))
        const pixelWidth = Math.floor(width * dpr)
        const pixelHeight = Math.floor(height * dpr)
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight
        context.setTransform(dpr, 0, 0, dpr, 0, 0)

        context.fillStyle = '#0b1220'
        context.fillRect(0, 0, width, height)
        drawRoundedRect(context, 22, 20, width - 44, height - 40, 18, '#111827', '#32415b')

        context.fillStyle = '#151f31'
        context.fillRect(22, 20, width - 44, 54)
        context.fillStyle = '#ff5f57'
        context.beginPath()
        context.arc(50, 47, 7, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#febc2e'
        context.beginPath()
        context.arc(73, 47, 7, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#28c840'
        context.beginPath()
        context.arc(96, 47, 7, 0, Math.PI * 2)
        context.fill()

        drawRoundedRect(context, 126, 32, width - 280, 30, 8, focused ? '#f8fafc' : '#dbe3ee', focused ? '#8aa6ff' : '#506079')
        context.fillStyle = '#111827'
        context.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace'
        context.fillText(addressDraft.slice(0, 90), 140, 52)
        context.fillStyle = '#aab6c8'
        context.font = '13px system-ui, sans-serif'
        context.fillText(formatTime(remaining), width - 122, 52)

        if (sessionState !== 'live') {
            drawCenteredMessage(context, width, height, sessionState === 'connecting' ? 'Connecting to remote Tor Browser' : sessionState === 'ended' ? 'Session closed' : 'Press Start to open the remote browser')
            return
        }

        const pageX = 48
        const pageY = 98
        const pageW = width - 96
        const pageH = height - 142
        drawRoundedRect(context, pageX, pageY, pageW, pageH, 12, '#f8fafc', '#cbd5e1')

        context.fillStyle = '#111827'
        context.font = '700 28px system-ui, sans-serif'
        context.fillText('Remote browser ready', pageX + 32, pageY + 58)
        context.font = '16px system-ui, sans-serif'
        context.fillStyle = '#475467'
        context.fillText('Click inside the viewport to send mouse and keyboard input.', pageX + 32, pageY + 90)
        context.fillText(readOnly ? 'View-only mode is enabled.' : 'Paste and copy shortcuts are forwarded to the remote session.', pageX + 32, pageY + 118)

        const cardY = pageY + 160
        const cardW = Math.max(140, (pageW - 88) / 3)
        ;['Pointer', 'Keyboard', 'Clipboard'].forEach((title, index) => {
            const x = pageX + 32 + index * (cardW + 12)
            drawRoundedRect(context, x, cardY, cardW, 94, 10, '#ffffff', '#d8e0eb')
            context.fillStyle = '#111827'
            context.font = '700 15px system-ui, sans-serif'
            context.fillText(title, x + 16, cardY + 32)
            context.fillStyle = '#667085'
            context.font = '13px system-ui, sans-serif'
            context.fillText(index === 0 ? `${clicks} clicks sent` : index === 1 ? 'Address bar and page input' : 'Native copy / paste', x + 16, cardY + 58)
        })

        context.fillStyle = '#3056d3'
        context.font = '700 14px system-ui, sans-serif'
        context.fillText('Connected target', pageX + 32, pageY + pageH - 68)
        context.fillStyle = '#111827'
        context.font = '15px ui-monospace, SFMono-Regular, Menlo, monospace'
        context.fillText(target.slice(0, 92), pageX + 32, pageY + pageH - 42)

        context.strokeStyle = '#111827'
        context.fillStyle = '#ffffff'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(cursor.x, cursor.y)
        context.lineTo(cursor.x + 18, cursor.y + 42)
        context.lineTo(cursor.x + 28, cursor.y + 25)
        context.lineTo(cursor.x + 47, cursor.y + 25)
        context.closePath()
        context.fill()
        context.stroke()
    }, [addressDraft, clicks, cursor.x, cursor.y, focused, readOnly, remaining, sessionState, target])

    useEffect(() => {
        draw()
    }, [draw])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const observer = new ResizeObserver(() => {
            draw()
            sendViewportResize()
        })
        observer.observe(container)
        return () => observer.disconnect()
    }, [draw])

    useEffect(() => {
        if (sessionState === 'live') sendViewportResize()
    }, [remoteFrame?.height, remoteFrame?.width, sessionState])

    const sendViewportResize = () => {
        const canvas = canvasRef.current
        if (!canvas || sessionState === 'idle' || sessionState === 'ended') return
        onInput({
            type: 'resize',
            width: Math.round(canvas.clientWidth),
            height: Math.round(canvas.clientHeight),
        })
    }

    const logicalPoint = (targetElement: HTMLCanvasElement, clientX: number, clientY: number) => {
        const rect = targetElement.getBoundingClientRect()
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        }
    }

    const remotePoint = (targetElement: HTMLCanvasElement, clientX: number, clientY: number) => {
        const point = logicalPoint(targetElement, clientX, clientY)
        if (!remoteFrame) return point

        const rect = targetElement.getBoundingClientRect()
        const scale = Math.min(rect.width / remoteFrame.width, rect.height / remoteFrame.height)
        const displayedWidth = remoteFrame.width * scale
        const displayedHeight = remoteFrame.height * scale
        const offsetX = (rect.width - displayedWidth) / 2
        const offsetY = (rect.height - displayedHeight) / 2
        const x = (point.x - offsetX) / scale
        const y = (point.y - offsetY) / scale

        return {
            x: Math.max(0, Math.min(remoteFrame.width, x)),
            y: Math.max(0, Math.min(remoteFrame.height, y)),
        }
    }

    const handlePointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const localPoint = logicalPoint(event.currentTarget, event.clientX, event.clientY)
        const point = remotePoint(event.currentTarget, event.clientX, event.clientY)
        setCursor(localPoint)
        if (readOnly || sessionState !== 'live') return
        onInput({ type: 'pointer', event: event.type, x: Math.round(point.x), y: Math.round(point.y), buttons: event.buttons, button: event.button })
    }

    const handleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const localPoint = logicalPoint(event.currentTarget, event.clientX, event.clientY)
        const point = remotePoint(event.currentTarget, event.clientX, event.clientY)
        setFocused(localPoint.y >= 28 && localPoint.y <= 66)
        setClicks((current) => current + 1)
        if (readOnly || sessionState !== 'live') return
        onInput({ type: 'click', x: Math.round(point.x), y: Math.round(point.y), button: event.button })
        onEvent('Mouse click sent to remote viewport.')
    }

    const handleKeyDown = async (event: KeyboardEvent<HTMLCanvasElement>) => {
        const shortcutKey = event.key.toLowerCase()
        if ((event.metaKey || event.ctrlKey) && ['a', 'c', 'v'].includes(shortcutKey)) {
            event.preventDefault()
        }
        if (sessionState !== 'live') return
        if (readOnly) return
        if ((event.metaKey || event.ctrlKey) && shortcutKey === 'v') {
            const text = await navigator.clipboard?.readText?.().catch(() => '') || ''
            if (text) {
                onLocalPaste(text)
                return
            }
        }
        if ((event.metaKey || event.ctrlKey) && shortcutKey === 'c') {
            onLocalCopyRequest()
            return
        }
        onInput({ type: 'key', key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey })
        if (!focused) {
            onEvent(`Key sent to remote: ${event.key}`)
            return
        }
        event.preventDefault()
        if (event.key === 'Enter') {
            onNavigate(addressDraft)
            return
        }
        if (event.key === 'Backspace') {
            setAddressDraft((current) => current.slice(0, -1))
            return
        }
        if (event.key.length === 1) {
            setAddressDraft((current) => `${current}${event.key}`)
        }
    }

    const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
        if (readOnly || sessionState !== 'live') return
        event.preventDefault()
        const point = remotePoint(event.currentTarget, event.clientX, event.clientY)
        onInput({
            type: 'wheel',
            x: Math.round(point.x),
            y: Math.round(point.y),
            deltaX: Math.round(event.deltaX),
            deltaY: Math.round(event.deltaY),
        })
    }

    const handlePaste = (event: ReactClipboardEvent<HTMLCanvasElement>) => {
        if (readOnly || sessionState !== 'live') return
        const text = event.clipboardData.getData('text/plain')
        if (!text) return
        event.preventDefault()
        onLocalPaste(text)
    }

    const handleCopy = (event: ReactClipboardEvent<HTMLCanvasElement>) => {
        if (readOnly || sessionState !== 'live') return
        event.preventDefault()
        onLocalCopyRequest()
    }

    return (
        <div ref={containerRef} className='relative min-h-0 bg-ui-canvas p-2'>
            <canvas
                ref={canvasRef}
                tabIndex={0}
                onPointerMove={handlePointer}
                onPointerDown={handlePointer}
                onPointerUp={handlePointer}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCopy={handleCopy}
                onWheel={handleWheel}
                className={`h-full min-h-[30rem] w-full rounded-md outline-none ring-0 focus:ring-2 focus:ring-ui-primary/20 ${remoteFrame ? 'cursor-default' : 'cursor-none'}`}
                aria-label='Interactive remote Tor browser viewport'
            />
            {sessionState === 'live' && remoteFrame && (
                <img
                    src={remoteFrame.image}
                    alt='Live remote Tor browser frame'
                    className='pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain'
                    width={remoteFrame.width}
                    height={remoteFrame.height}
                />
            )}
            {sessionState !== 'live' && (
                <div className='pointer-events-none absolute inset-2 grid place-items-center rounded-md border border-ui-border bg-ui-canvas/90'>
                    <div className='max-w-md rounded-lg border border-ui-border bg-ui-raised p-5 text-center shadow-sm'>
                        <p className='text-xl font-semibold text-ui-text'>{sessionState === 'connecting' ? 'Connecting to remote Tor Browser' : sessionState === 'ended' ? 'Session closed' : 'Press Start to open the remote browser'}</p>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>Start a session, then interact with the remote browser inside this frame.</p>
                    </div>
                </div>
            )}
        </div>
    )
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke: string) {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
    context.fillStyle = fill
    context.fill()
    context.strokeStyle = stroke
    context.stroke()
}

function drawCenteredMessage(context: CanvasRenderingContext2D, width: number, height: number, message: string) {
    drawRoundedRect(context, width / 2 - 210, height / 2 - 72, 420, 144, 14, '#172033', '#33445f')
    context.fillStyle = '#eef4ff'
    context.font = '700 22px system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText(message, width / 2, height / 2 - 8)
    context.fillStyle = '#9aa8bd'
    context.font = '14px system-ui, sans-serif'
    context.fillText('Start a session to attach the remote browser stream.', width / 2, height / 2 + 26)
    context.textAlign = 'start'
}
