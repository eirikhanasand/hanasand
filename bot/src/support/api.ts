export type SupportTicket = {
    id: string
    subject: string
    status: 'open' | 'closed'
    channel: string
    user_name: string
    created_at: string
    updated_at: string
    resolved_at: string | null
    first_message: string
    requester_discord_id: string | null
}

export type SupportMessage = {
    id: string
    sender_kind: string
    sender_name: string
    body: string
    created_at: string
}

export class SupportApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message)
        this.name = 'SupportApiError'
    }
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ticket(value: unknown): SupportTicket | null {
    if (!record(value) || typeof value.id !== 'string' || typeof value.subject !== 'string'
        || (value.status !== 'open' && value.status !== 'closed') || typeof value.channel !== 'string') return null
    return {
        id: value.id,
        subject: value.subject,
        status: value.status,
        channel: value.channel,
        user_name: typeof value.user_name === 'string' ? value.user_name : 'Visitor',
        created_at: typeof value.created_at === 'string' ? value.created_at : '',
        updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
        resolved_at: typeof value.resolved_at === 'string' ? value.resolved_at : null,
        first_message: typeof value.first_message === 'string' ? value.first_message : '',
        requester_discord_id: typeof value.requester_discord_id === 'string' ? value.requester_discord_id : null,
    }
}

export class SupportApi {
    constructor(private readonly base: URL, private readonly apiKey: string) {}

    private async request(path: string, init: RequestInit = {}) {
        const url = new URL(path, this.base)
        let response: Response
        const headers = new Headers(init.headers)
        headers.set('X-API-Key', this.apiKey)
        if (init.body) headers.set('content-type', 'application/json')
        try {
            response = await fetch(url, {
                ...init,
                headers,
                redirect: 'error',
                signal: AbortSignal.timeout(10_000),
            })
        } catch {
            throw new SupportApiError(503, 'The website support service could not be reached.')
        }

        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) {
            const detail = record(payload) && typeof payload.error === 'string' ? `: ${payload.error.slice(0, 240)}` : ''
            throw new SupportApiError(response.status, `Website support returned HTTP ${response.status}${detail}`)
        }
        return payload
    }

    async getTickets() {
        const payload = await this.request('/api/support/tickets')
        if (!record(payload) || !Array.isArray(payload.tickets)) throw new SupportApiError(502, 'Website support returned an invalid ticket list.')
        return payload.tickets.map(ticket).filter((value): value is SupportTicket => value !== null)
    }

    async getDiscordTickets(discordUserId: string, page: number) {
        const params = new URLSearchParams({ discordUserId, page: String(page) })
        const payload = await this.request(`/api/support/discord/tickets?${params}`)
        if (!record(payload) || !Array.isArray(payload.tickets) || typeof payload.hasMore !== 'boolean') {
            throw new SupportApiError(502, 'Website support returned invalid Discord ticket history.')
        }
        return { tickets: payload.tickets.map(ticket).filter((value): value is SupportTicket => value !== null), hasMore: payload.hasMore }
    }

    async restoreDiscordTicket(discordUserId: string, ticketId: string) {
        const payload = await this.discordAction({ action: 'restore', discordUserId, ticketId })
        if (!record(payload) || !record(payload.ticket) || typeof payload.isOwner !== 'boolean') throw new SupportApiError(502, 'Website support returned an invalid ticket.')
        const value = ticket(payload.ticket)
        if (!value) throw new SupportApiError(502, 'Website support returned an invalid ticket.')
        return { ticket: value, isOwner: payload.isOwner }
    }

    async discordAction(input: Record<string, unknown>) {
        return this.request('/api/support/discord/action', { method: 'POST', body: JSON.stringify(input) })
    }

    async getMessages(ticketId: string) {
        const payload = await this.request(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`)
        if (!record(payload) || !Array.isArray(payload.messages)) throw new SupportApiError(502, 'Website support returned an invalid message list.')
        return payload.messages.filter((value): value is SupportMessage => record(value)
            && typeof value.id === 'string' && typeof value.sender_kind === 'string'
            && typeof value.body === 'string' && typeof value.created_at === 'string')
            .map(value => ({
                id: value.id,
                sender_kind: value.sender_kind,
                sender_name: typeof value.sender_name === 'string' ? value.sender_name : 'Support',
                body: value.body,
                created_at: value.created_at,
            }))
    }

    async postReply(ticketId: string, message: string, requestId: string) {
        return this.request(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message, requestId }),
        })
    }
}
