import pg from 'pg'
import { supportConnection } from './db.ts'

export type SupportChange = { id: string; visitor: string | null; user: string | null; channel: string }

// One listener per API process, shared by all support sockets. Reconnects resync clients.
export function supportNotifications(onError: (error: Error) => void) {
    const listeners = new Set<(change?: SupportChange) => void>()
    let client: pg.Client | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let stopped = false
    async function connect() {
        if (client || stopped || !listeners.size) return
        const next = new pg.Client({ ...supportConnection(),
            application_name: 'support-live', connectionTimeoutMillis: 5000, query_timeout: 5000, keepAlive: true })
        client = next
        let failed = false
        const reconnect = (error?: Error) => {
            if (failed || client !== next) return
            failed = true
            if (error) onError(error)
            clearInterval(heartbeat)
            if (client === next) client = undefined
            void next.end().catch(() => {})
            if (!stopped && listeners.size) retry = setTimeout(() => { void connect() }, 1000)
        }
        next.on('error', reconnect)
        next.on('end', () => reconnect())
        next.on('notification', event => {
            if (event.channel !== 'support_changed' || !event.payload) return
            try { const change = JSON.parse(event.payload); for (const listener of listeners) listener(change) } catch { /* Invalid events cannot address a socket. */ }
        })
        try {
            await next.connect()
            await next.query('LISTEN support_changed')
            if (failed || stopped) return
            for (const listener of listeners) listener()
            heartbeat = setInterval(() => { void next.query('SELECT 1').catch(reconnect) }, 20000)
        } catch (error) { reconnect(error as Error) }
    }
    return {
        subscribe(listener: (change?: SupportChange) => void) {
            listeners.add(listener)
            void connect()
            return () => {
                listeners.delete(listener)
                if (!listeners.size) {
                    clearTimeout(retry); clearInterval(heartbeat)
                    const previous = client; client = undefined
                    void previous?.end().catch(() => {})
                }
            }
        },
        async close() { stopped = true; listeners.clear(); clearTimeout(retry); clearInterval(heartbeat); await client?.end().catch(() => {}) },
    }
}
