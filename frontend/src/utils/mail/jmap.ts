type JmapMethodResponse<T> = [string, T, string]

type JmapSession = {
    apiUrl: string
    primaryAccounts?: Record<string, string>
    accounts?: Record<string, { accountCapabilities?: Record<string, unknown> }>
}

type JmapEmailAddress = {
    name?: string
    email?: string
}

type JmapBodyPart = {
    partId?: string
    type?: string
}

type JmapBodyValue = {
    value?: string
}

type JmapEmail = {
    id: string
    subject?: string
    preview?: string
    receivedAt?: string
    from?: JmapEmailAddress[]
    to?: JmapEmailAddress[]
    cc?: JmapEmailAddress[]
    textBody?: JmapBodyPart[]
    htmlBody?: JmapBodyPart[]
    bodyValues?: Record<string, JmapBodyValue>
}

export type MailMessageSummary = {
    id: string
    subject: string
    preview: string
    receivedAt: string
    from: string
}

export type MailMessageDetail = MailMessageSummary & {
    to: string
    cc: string
    body: string
}

type InboxPayload = {
    messages: MailMessageSummary[]
    selected: MailMessageDetail | null
}

const MAIL_CAPABILITY = 'urn:ietf:params:jmap:mail'
const CORE_CAPABILITY = 'urn:ietf:params:jmap:core'

export async function getInboxPayload(selectedMessageId?: string): Promise<InboxPayload> {
    const session = await getSession()
    const accountId = getPrimaryAccountId(session)
    const inboxId = await getInboxMailboxId(session, accountId)

    if (!inboxId) {
        return { messages: [], selected: null }
    }

    const messages = await listInboxMessages(session, accountId, inboxId)
    const selectedId = selectedMessageId || messages[0]?.id
    const selected = selectedId ? await getMessage(session, accountId, selectedId) : null

    return { messages, selected }
}

async function getSession(): Promise<JmapSession> {
    const response = await fetch(joinMailUrl('/jmap/session'), {
        headers: getMailHeaders(),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(`Unable to reach mail session endpoint: ${response.status}`)
    }

    return response.json()
}

function getPrimaryAccountId(session: JmapSession) {
    const primaryAccountId = session.primaryAccounts?.[MAIL_CAPABILITY]

    if (!primaryAccountId) {
        throw new Error('No primary mail account is configured in Stalwart.')
    }

    return primaryAccountId
}

async function getInboxMailboxId(session: JmapSession, accountId: string) {
    const response = await callJmap<{ list?: Array<{ id: string, role?: string }> }>(session, [
        [
            'Mailbox/get',
            {
                accountId,
                properties: ['id', 'role'],
            },
            'mailboxes',
        ],
    ])

    return response.list?.find((mailbox) => mailbox.role === 'inbox')?.id || null
}

async function listInboxMessages(session: JmapSession, accountId: string, inboxId: string): Promise<MailMessageSummary[]> {
    const query = await callJmap<{ ids?: string[] }>(session, [
        [
            'Email/query',
            {
                accountId,
                filter: {
                    inMailbox: inboxId,
                },
                sort: [{ property: 'receivedAt', isAscending: false }],
                limit: 25,
            },
            'emails',
        ],
    ])

    const ids = query.ids || []
    if (!ids.length) {
        return []
    }

    const messages = await fetchEmails(session, accountId, ids)
    return messages.map(toSummary)
}

async function getMessage(session: JmapSession, accountId: string, id: string): Promise<MailMessageDetail | null> {
    const messages = await fetchEmails(session, accountId, [id])
    const message = messages[0]

    return message ? toDetail(message) : null
}

async function fetchEmails(session: JmapSession, accountId: string, ids: string[]): Promise<JmapEmail[]> {
    const response = await callJmap<{ list?: JmapEmail[] }>(session, [
        [
            'Email/get',
            {
                accountId,
                ids,
                properties: ['id', 'subject', 'receivedAt', 'preview', 'from', 'to', 'cc', 'textBody', 'htmlBody', 'bodyValues'],
                fetchAllBodyValues: true,
            },
            'email-details',
        ],
    ])

    return response.list || []
}

async function callJmap<T>(session: JmapSession, methodCalls: Array<[string, Record<string, unknown>, string]>): Promise<T> {
    const response = await fetch(toApiUrl(session.apiUrl), {
        method: 'POST',
        headers: {
            ...getMailHeaders(),
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
            using: [CORE_CAPABILITY, MAIL_CAPABILITY],
            methodCalls,
        }),
    })

    if (!response.ok) {
        throw new Error(`Unable to query JMAP: ${response.status}`)
    }

    const payload = await response.json() as { methodResponses?: Array<JmapMethodResponse<T>> }
    return payload.methodResponses?.[0]?.[1] as T
}

function toApiUrl(apiUrl: string) {
    try {
        return new URL(apiUrl).toString()
    } catch {
        return joinMailUrl(apiUrl)
    }
}

function joinMailUrl(path: string) {
    const baseUrl = process.env.MAIL_JMAP_INTERNAL_URL || process.env.MAIL_PUBLIC_BASE_URL || 'http://stalwart:8080'
    return new URL(path, ensureTrailingSlash(baseUrl)).toString()
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}

function getMailHeaders() {
    const username = process.env.MAIL_INBOX_USERNAME || process.env.MAIL_INBOX_ADDRESS
    const password = process.env.MAIL_INBOX_PASSWORD

    if (!username || !password) {
        throw new Error('Mail credentials are missing. Set MAIL_INBOX_USERNAME or MAIL_INBOX_ADDRESS, plus MAIL_INBOX_PASSWORD.')
    }

    return {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        Accept: 'application/json',
    }
}

function toSummary(message: JmapEmail): MailMessageSummary {
    return {
        id: message.id,
        subject: message.subject || '(No subject)',
        preview: message.preview || 'No preview available yet.',
        receivedAt: message.receivedAt || '',
        from: formatAddresses(message.from),
    }
}

function toDetail(message: JmapEmail): MailMessageDetail {
    return {
        ...toSummary(message),
        to: formatAddresses(message.to),
        cc: formatAddresses(message.cc),
        body: extractBody(message),
    }
}

function extractBody(message: JmapEmail) {
    const partId = message.textBody?.[0]?.partId || message.htmlBody?.[0]?.partId
    const raw = (partId && message.bodyValues?.[partId]?.value) || message.preview || ''

    return normalizeWhitespace(stripHtml(raw)) || 'This message does not include a readable text body yet.'
}

function stripHtml(value: string) {
    return value
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;/gi, '\'')
        .replace(/&quot;/gi, '"')
}

function normalizeWhitespace(value: string) {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim()
}

function formatAddresses(addresses?: JmapEmailAddress[]) {
    if (!addresses?.length) {
        return ''
    }

    return addresses
        .map((entry) => entry.name ? `${entry.name} <${entry.email || ''}>` : (entry.email || 'Unknown sender'))
        .join(', ')
}
