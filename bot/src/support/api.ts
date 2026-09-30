export type SupportTicket = {
    id: string
    subject: string
    status: 'open' | 'closed'
    channel: string
    user_name: string
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
