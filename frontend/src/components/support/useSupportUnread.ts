'use client'

import { useEffect, useState } from 'react'
import { getSupportUnreadCounts, markSupportMessagesRead, supportReadStateKey, SUPPORT_READ_STATE_EVENT } from '@/utils/supportUnread'

type Ticket = { id: string; reply_count?: number }
export default function useSupportUnread(tickets: Ticket[], selectedId: string, active: boolean, scope: string) {
    const [unread, setUnread] = useState<Record<string, number>>({})
    useEffect(() => {
        const update = () => {
            const selected = tickets.find(ticket => ticket.id === selectedId)
            if (selected && active && document.visibilityState === 'visible') {
                markSupportMessagesRead(scope, selected.id, selected.reply_count || 0)
            }
            const counts = getSupportUnreadCounts(tickets, scope)
            setUnread(previous => Object.keys(previous).length === Object.keys(counts).length && Object.keys(counts).every(id => previous[id] === counts[id]) ? previous : counts)
        }
        update()
        const onStorage = (event: StorageEvent) => { if (event.key === supportReadStateKey(scope)) update() }
        const onReadState = (event: Event) => {
            if ((event as CustomEvent<{ scope?: string }>).detail?.scope === scope) update()
        }
        window.addEventListener('storage', onStorage)
        window.addEventListener(SUPPORT_READ_STATE_EVENT, onReadState)
        document.addEventListener('visibilitychange', update)
        return () => {
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(SUPPORT_READ_STATE_EVENT, onReadState)
            document.removeEventListener('visibilitychange', update)
        }
    }, [tickets, selectedId, active, scope])
    return unread
}
