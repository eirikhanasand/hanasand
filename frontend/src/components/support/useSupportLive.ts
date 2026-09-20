'use client'

import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export default function useSupportLive(refresh: () => Promise<void | boolean>, guest: boolean, enabled = true) {
    const latest = useRef(refresh)
    latest.current = refresh
    const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'legacy'>('connecting')
    useEffect(() => {
        if (!enabled) return
        let disposed = false, running = false, pending = false, attempts = 0
        let socket: WebSocket | undefined
        let retry: ReturnType<typeof setTimeout> | undefined
        let ready = false, connecting = false, available = true
        const sync = async () => {
            pending = true
            if (running) return
            running = true
            try {
                while (pending && !disposed) {
                    pending = false
                    try { const supported = await latest.current(); if (typeof supported === 'boolean') available = supported } catch { /* The view preserves its data and shows the request error. */ }
                }
            } finally { running = false }
        }
        const reconnect = () => {
            if (disposed || retry) return
            ready = false
            setConnection('reconnecting')
            retry = setTimeout(() => { retry = undefined; void connect() }, Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4)))
        }
        async function connect() {
            if (disposed || connecting || socket && socket.readyState < WebSocket.CLOSING) return
            connecting = true
            try {
                // Initial GET establishes the HttpOnly guest session before issuing a one-use socket ticket.
                await sync()
                if (!available) { setConnection('legacy'); return }
                let auth: { type: string; ticket?: string; id?: string; token?: string }
                if (guest) {
                    const response = await fetch('/api/support/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) })
                    const payload = await response.json()
                    if (!response.ok || !payload.ticket) throw new Error('Connection unavailable')
                    auth = { type: 'auth', ticket: payload.ticket }
                } else auth = { type: 'auth', id: getCookie('impersonating_id') || getCookie('id') || '', token: getCookie('access_token') || '' }
                if (disposed) return
                const next = new WebSocket(`${config.url.api_wss}/support`)
                socket = next
                const deadline = setTimeout(() => { if (!ready) next.close() }, 10000)
                next.onopen = () => next.send(JSON.stringify(auth))
                next.onmessage = event => {
                    try {
                        const message = JSON.parse(event.data)
                        if (message.type === 'ready') { ready = true; attempts = 0; clearTimeout(deadline); setConnection('connected'); void sync() }
                        else if (message.type === 'changed') void sync()
                    } catch { /* Ignore malformed events. */ }
                }
                next.onerror = () => next.close()
                next.onclose = () => { clearTimeout(deadline); if (socket === next) { socket = undefined; reconnect() } }
            } catch { reconnect() } finally { connecting = false }
        }
        const visible = () => { if (document.visibilityState === 'visible') { void sync(); if (!ready && !retry) void connect() } }
        const online = () => { clearTimeout(retry); retry = undefined; if (socket) socket.close(); else void connect() }
        void connect()
        // Keep older servers usable during rolling releases; upgraded servers switch to events.
        const fallback = setInterval(() => { if (!ready) void sync().then(() => { if (available && !socket && !retry) void connect() }) }, 4000)
        window.addEventListener('online', online)
        document.addEventListener('visibilitychange', visible)
        return () => { disposed = true; clearTimeout(retry); clearInterval(fallback); socket?.close(); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible) }
    }, [guest, enabled])
    return connection
}
