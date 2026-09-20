'use client'

import { useEffect, useRef, useState } from 'react'

type Ticket = { id: string; reply_count?: number }
export default function useSupportUnread(tickets: Ticket[], selectedId: string, active: boolean, scope: string) {
    const memory = useRef<Record<string, number>>({})
    const [unread, setUnread] = useState<Record<string, number>>({})
    useEffect(() => {
        const key = `hanasand-support-read:${scope}`
        const update = () => {
            let read: Record<string, number> = memory.current
            try { const value = JSON.parse(localStorage.getItem(key) || '{}'); if (value && typeof value === 'object') read = value } catch { /* Keep the conversation available without storage. */ }
            const counts: Record<string, number> = {}
            for (const ticket of tickets) {
                const count = ticket.reply_count || 0
                if (ticket.id === selectedId && active && document.visibilityState === 'visible') read[ticket.id] = count
                counts[ticket.id] = Math.max(0, count - (Number.isFinite(read[ticket.id]) ? read[ticket.id] : 0))
            }
            memory.current = read
            try { localStorage.setItem(key, JSON.stringify(read)) } catch { /* The current view can still mark replies as read. */ }
            setUnread(previous => Object.keys(previous).length === Object.keys(counts).length && Object.keys(counts).every(id => previous[id] === counts[id]) ? previous : counts)
        }
        update()
        window.addEventListener('storage', update)
        document.addEventListener('visibilitychange', update)
        return () => { window.removeEventListener('storage', update); document.removeEventListener('visibilitychange', update) }
    }, [tickets, selectedId, active, scope])
    return unread
}
