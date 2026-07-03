'use client'

import { getCookie } from '@/utils/cookies/cookies'
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

    const response = await fetchWithTimeout(`/api/backend/mail/overview?${search.toString()}`, {
        headers,
        cache: 'no-store',
    }, 15_000)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error((payload as { error?: string }).error || 'Mail is unavailable right now. The rest of the console is still ready.')
    }

    return normalizeMailOverview(payload as Partial<MailOverview>)
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
    const response = await fetch(`/api/backend/mail/filters/${id}${search}`, { method: 'DELETE', headers })
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error((payload as { error?: string }).error || 'Unable to delete filter.')
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
    return `/api/backend/mail/blob/${encodeURIComponent(mailboxUser)}/${encodeURIComponent(blobId)}/${encodeURIComponent(name)}`
}

async function postJson(path: string, body: Record<string, unknown>) {
    const headers = authHeaders()
    if (!headers) {
        throw new Error('Unauthorized.')
    }

    const response = await fetch(`/api/backend${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Request failed.')
    }

    return payload
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Mail did not respond in time. Message and folder actions are temporarily paused.', { cause: error })
        }

        throw error
    } finally {
        window.clearTimeout(timeout)
    }
}

function normalizeMailOverview(payload: Partial<MailOverview>): MailOverview {
    const mailboxUser = payload.mailboxUser || getCookie('id') || ''
    const mailboxAddress = payload.mailboxAddress || (mailboxUser ? `${mailboxUser}@hanasand.com` : '')

    return {
        actor: {
            id: payload.actor?.id || getCookie('id') || mailboxUser,
            canAccessAnyMailbox: Boolean(payload.actor?.canAccessAnyMailbox),
        },
        mailboxUser,
        mailboxAddress,
        accessibleAccounts: payload.accessibleAccounts || [],
        mailboxes: payload.mailboxes || [],
        selectedMailboxId: payload.selectedMailboxId || null,
        messages: payload.messages || [],
        selectedMessage: payload.selectedMessage || null,
        filters: payload.filters || [],
        recentRecipients: payload.recentRecipients || [],
        health: payload.health || null,
        settings: payload.settings || {
            host: '',
            imapHost: '',
            imapPort: 0,
            smtpHost: '',
            smtpPort: 0,
            managesievePort: 0,
            username: mailboxUser,
            address: mailboxAddress,
        },
    }
}
