'use client'

import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export const SUPPORT_CHAT_OPENED_EVENT = 'hanasand-support-chat-opened'

export default function useSupportLive(refresh: () => Promise<void | boolean>, guest: boolean, enabled = true) {
    const latest = useRef(refresh)
    latest.current = refresh
    const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'idle'>('connecting')
    useEffect(() => {
        if (!enabled) return
        let disposed = false, running = false, pending = false, attempts = 0
        let socket: WebSocket | undefined
        let retry: ReturnType<typeof setTimeout> | undefined
        let reconnectNotice: ReturnType<typeof setTimeout> | undefined
        let initialized = false
        let ready = false, connecting = false, available = true
        const sync = async () => {
            pending = true
            if (running) return
            running = true
            try {
                while (pending && !disposed) {
                    pending = false
                    try {
                        const supported = await latest.current()
                        if (typeof supported === 'boolean') {
                            available = supported
                            if (!available) { setConnection('idle'); socket?.close() }
                        }
                    } catch { /* The view preserves its data and shows the request error. */ }
                }
            } finally { running = false }
        }
        const reconnect = () => {
            if (disposed || retry || !available) return
            ready = false
            if (!reconnectNotice) reconnectNotice = setTimeout(() => { reconnectNotice = undefined; if (!disposed && !ready) setConnection('reconnecting') }, 10_000)
            retry = setTimeout(() => { retry = undefined; void connect() }, Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4)))
        }
        async function connect() {
            if (disposed || connecting || socket && socket.readyState < WebSocket.CLOSING) return
            connecting = true
            setConnection('connecting')
            try {
                // The first GET establishes the HttpOnly guest session before issuing a one-use socket ticket.
                // Reconnects can reuse that session and let the socket event trigger the next snapshot.
                if (!initialized || !available) await sync()
                initialized = true
                if (!available) { setConnection('idle'); return }
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
                        if (message.type === 'ready') { ready = true; attempts = 0; clearTimeout(deadline); clearTimeout(reconnectNotice); reconnectNotice = undefined; setConnection('connected'); void sync() }
                        else if (message.type === 'changed') void sync()
                    } catch { /* Ignore malformed events. */ }
                }
                next.onerror = () => next.close()
                next.onclose = () => { clearTimeout(deadline); if (socket === next) { socket = undefined; ready = false; reconnect() } }
            } catch { reconnect() } finally { connecting = false }
        }
        const visible = () => {
            if (document.visibilityState !== 'visible' || ready || !available) return
            if (retry) { clearTimeout(retry); retry = undefined }
            void connect()
        }
        const online = () => {
            if (!available) return
            clearTimeout(retry); retry = undefined
            if (socket) socket.close(); else void connect()
        }
        const chatOpened = () => {
            available = true
            if (!ready && !socket && !retry) void connect()
        }
        void connect()
        window.addEventListener('online', online)
        window.addEventListener(SUPPORT_CHAT_OPENED_EVENT, chatOpened)
        document.addEventListener('visibilitychange', visible)
        return () => { disposed = true; clearTimeout(retry); clearTimeout(reconnectNotice); socket?.close(); window.removeEventListener('online', online); window.removeEventListener(SUPPORT_CHAT_OPENED_EVENT, chatOpened); document.removeEventListener('visibilitychange', visible) }
    }, [guest, enabled])
    return connection
}
