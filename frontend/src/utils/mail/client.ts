'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { impersonationHeaders } from '@/utils/impersonation/client'
import type { MailOverview } from './types'

export type DraftAttachment = {
    name: string
    type: string
    contentBase64: string
    size: number
}

function authHeaders() {
    const token = getCookie('access_token')
    const id = getCookie('id')

    if (!token || !id) {
        return null
    }

    return {
        'Content-Type': 'application/json',
        id,
        Authorization: `Bearer ${token}`,
        ...impersonationHeaders(),
    }
}

export async function fetchMailOverview(params: { mailboxUser?: string, mailboxId?: string | null, messageId?: string | null } = {}) {
    const headers = authHeaders()
    if (!headers) {
        throw new Error('Unauthorized.')
    }

    const search = new URLSearchParams()
    if (params.mailboxUser) {
        search.set('mailboxUser', params.mailboxUser)
    }
    if (params.mailboxId) {
        search.set('mailboxId', params.mailboxId)
    }
    if (params.messageId) {
        search.set('messageId', params.messageId)
    }

    const response = await fetch(`${config.url.api}/mail/overview?${search.toString()}`, {
        headers,
        cache: 'no-store',
    })
    if (!response.ok) {
        throw new Error((await response.json()).error || 'Unable to load mail.')
    }

    return response.json() as Promise<MailOverview>
}

export async function sendMail(body: {
    mailboxUser?: string
    to: string
    cc?: string
    bcc?: string
    replyTo?: string
    subject: string
    textBody: string
    htmlBody?: string
    attachments?: DraftAttachment[]
}) {
    return postJson('/mail/send', body) as Promise<{
        ok: boolean
        mailboxUser: string
        sentMailboxId: string | null
        sentMessageId: string | null
    } | null>
}

export async function createMailbox(body: { mailboxUser?: string, name: string, parentId?: string | null }) {
    return postJson('/mail/mailboxes', body)
}

export async function createFilter(body: {
    mailboxUser?: string
    name: string
    enabled?: boolean
    criteria: { field: 'from' | 'subject' | 'body' | 'senderDomain', contains: string }
    action: { type: 'move', mailboxName: string, markRead?: boolean }
}) {
    return postJson('/mail/filters', body)
}

export async function deleteFilter(id: number, mailboxUser?: string) {
    const headers = authHeaders()
    if (!headers) {
        throw new Error('Unauthorized.')
    }

    const search = mailboxUser ? `?mailboxUser=${encodeURIComponent(mailboxUser)}` : ''
    const response = await fetch(`${config.url.api}/mail/filters/${id}${search}`, { method: 'DELETE', headers })
    if (!response.ok) {
        throw new Error((await response.json()).error || 'Unable to delete filter.')
    }
}

export async function messageAction(messageId: string, body: {
    mailboxUser?: string
    action: 'read' | 'unread' | 'flag' | 'unflag' | 'archive' | 'junk' | 'ham' | 'trash' | 'restore' | 'move'
    targetMailboxId?: string
    targetMailboxName?: string
}) {
    return postJson(`/mail/message/${messageId}/action`, body)
}

export function mailBlobUrl(mailboxUser: string, blobId: string, name: string) {
    return `${config.url.api}/mail/blob/${encodeURIComponent(mailboxUser)}/${encodeURIComponent(blobId)}/${encodeURIComponent(name)}`
}

async function postJson(path: string, body: Record<string, unknown>) {
    const headers = authHeaders()
    if (!headers) {
        throw new Error('Unauthorized.')
    }

    const response = await fetch(`${config.url.api}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error((await response.json()).error || 'Request failed.')
    }

    return response.json().catch(() => null)
}
