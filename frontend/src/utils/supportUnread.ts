export const SUPPORT_READ_STATE_EVENT = 'hanasand-support-read-state'
export const SUPPORT_TICKETS_UPDATED_EVENT = 'hanasand-support-tickets-updated'

export type SupportUnreadTicket = { id: string; reply_count?: number; status?: string }

export function supportReadStateKey(scope: string) {
    return `hanasand-support-read:${scope}`
}

export function getSupportUnreadCounts(tickets: SupportUnreadTicket[], scope: string) {
    const read = getSupportReadState(scope)
    return Object.fromEntries(tickets.map(ticket => [ticket.id, Math.max(0, (ticket.reply_count || 0) - (read[ticket.id] || 0))]))
}

export function hasUnreadSupportMessages(tickets: SupportUnreadTicket[], scope: string) {
    return Object.values(getSupportUnreadCounts(tickets, scope)).some(count => count > 0)
}

export function markSupportMessagesRead(scope: string, ticketId: string, count: number) {
    if (!ticketId || !Number.isSafeInteger(count) || count < 0) return false
    const read = getSupportReadState(scope)
    if (count <= (read[ticketId] || 0)) return false
    read[ticketId] = count
    rememberSupportReadState(scope, read)
    try { localStorage.setItem(supportReadStateKey(scope), JSON.stringify(read)) } catch { /* Keep the read state in memory when storage is unavailable. */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SUPPORT_READ_STATE_EVENT, { detail: { scope } }))
    return true
}

function getSupportReadState(scope: string): Record<string, number> {
    const read: Record<string, number> = Object.create(null)
    try {
        const value: unknown = JSON.parse(localStorage.getItem(supportReadStateKey(scope)) || '{}')
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [ticketId, count] of Object.entries(value)) {
                if (Number.isSafeInteger(count) && typeof count === 'number' && count >= 0) read[ticketId] = count
            }
        }
    } catch { /* Continue with the in-memory read state. */ }
    if (typeof window !== 'undefined') {
        try {
            const memory = supportReadMemory.get(scope)
            if (memory) for (const [ticketId, count] of Object.entries(memory)) read[ticketId] = Math.max(read[ticketId] || 0, count)
        } catch { /* localStorage remains the source of truth when memory is unavailable. */ }
    }
    return read
}

function rememberSupportReadState(scope: string, read: Record<string, number>) {
    supportReadMemory.set(scope, read)
}

const supportReadMemory = new Map<string, Record<string, number>>()
