import type { MailAddress, MailAttachment, MailMessage, MailMessageSummary, MailboxItem } from './types.ts'
import { mailConfig } from './config.ts'
import { normalizeMessageText, stripHtml } from './helpers.ts'

type JmapSession = {
    apiUrl: string
    downloadUrl: string
    uploadUrl: string
    primaryAccounts?: Record<string, string>
}

type MailboxRecord = MailboxItem & {
    myRights?: Record<string, boolean>
}

type EmailRecord = {
    id: string
    threadId?: string
    mailboxIds?: Record<string, boolean>
    keywords?: Record<string, boolean>
    subject?: string
    preview?: string
    receivedAt?: string
    sentAt?: string
    from?: MailAddress[]
    to?: MailAddress[]
    cc?: MailAddress[]
    bcc?: MailAddress[]
    replyTo?: MailAddress[]
    hasAttachment?: boolean
    attachments?: Array<{
        blobId: string
        name?: string
        type?: string
        size?: number
        disposition?: string
        cid?: string | null
    }>
    textBody?: Array<{ partId?: string }>
    htmlBody?: Array<{ partId?: string }>
    bodyValues?: Record<string, { value?: string }>
}

const CORE = 'urn:ietf:params:jmap:core'
const MAIL = 'urn:ietf:params:jmap:mail'
const SUBMISSION = 'urn:ietf:params:jmap:submission'
const SIEVE = 'urn:ietf:params:jmap:sieve'

export async function getMailSession(username: string, password: string) {
    const response = await fetch(new URL('/jmap/session', ensureTrailingSlash(mailConfig.internalUrl)), {
        headers: authHeaders(username, password),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(`Unable to reach mail session endpoint: ${response.status}`)
    }

    const session = await response.json() as JmapSession
    const accountId = session.primaryAccounts?.[MAIL]
    if (!accountId) {
        throw new Error('No primary mail account available.')
    }

    return { session, accountId }
}

export async function getMailboxList(username: string, password: string) {
    const { session, accountId } = await getMailSession(username, password)
    const result = await jmapCall<{ list?: MailboxRecord[] }>(username, password, session, [
        ['Mailbox/get', { accountId, properties: ['id', 'name', 'role', 'parentId', 'sortOrder', 'totalEmails', 'unreadEmails', 'myRights'] }, 'mailboxes']
    ])

    return { accountId, session, mailboxes: (result.list || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name)) }
}

export async function listMessages(username: string, password: string, mailboxId: string, limit = 50) {
    const { session, accountId } = await getMailSession(username, password)
    const query = await jmapCall<{ ids?: string[] }>(username, password, session, [
        ['Email/query', { accountId, filter: { inMailbox: mailboxId }, sort: [{ property: 'receivedAt', isAscending: false }], limit }, 'query']
    ])

    const ids = query.ids || []
    if (!ids.length) {
        return []
    }

    const messages = await getEmailsByIds(username, password, session, accountId, ids)
    return messages.map(toSummary)
}

export async function getMessage(username: string, password: string, messageId: string) {
    const { session, accountId } = await getMailSession(username, password)
    const messages = await getEmailsByIds(username, password, session, accountId, [messageId])
    return messages[0] ? toMessage(messages[0]) : null
}

export async function createMailbox(username: string, password: string, name: string, parentId?: string | null) {
    const { session, accountId } = await getMailSession(username, password)
    const createId = `mailbox-${Date.now()}`
    await jmapCall(username, password, session, [
        ['Mailbox/set', { accountId, create: { [createId]: { name, parentId: parentId || null } } }, 'create-mailbox']
    ])
}

export async function ensureMailbox(username: string, password: string, name: string, role?: string) {
    const { mailboxes } = await getMailboxList(username, password)
    const existing = mailboxes.find(mailbox => mailbox.name.toLowerCase() === name.toLowerCase() || (role && mailbox.role === role))
    if (existing) {
        return existing.id
    }

    await createMailbox(username, password, name)
    const refreshed = await getMailboxList(username, password)
    return refreshed.mailboxes.find(mailbox => mailbox.name.toLowerCase() === name.toLowerCase())?.id || null
}

export async function moveMessage(username: string, password: string, messageId: string, mailboxId: string, keywordPatch: Record<string, boolean | null> = {}) {
    const { session, accountId } = await getMailSession(username, password)
    await jmapCall(username, password, session, [
        ['Email/set', { accountId, update: { [messageId]: { mailboxIds: { [mailboxId]: true }, ...Object.fromEntries(Object.entries(keywordPatch).map(([key, value]) => [`keywords/${key}`, value])) } } }, 'move']
    ])
}

export async function patchMessageKeywords(username: string, password: string, messageId: string, keywords: Record<string, boolean | null>) {
    const { session, accountId } = await getMailSession(username, password)
    await jmapCall(username, password, session, [
        ['Email/set', { accountId, update: { [messageId]: Object.fromEntries(Object.entries(keywords).map(([key, value]) => [`keywords/${key}`, value])) } }, 'keywords']
    ])
}

export async function uploadAttachment(username: string, password: string, filename: string, type: string, contentBase64: string) {
    const { session, accountId } = await getMailSession(username, password)
    const formData = new FormData()
    const bytes = Buffer.from(contentBase64, 'base64')
    formData.set('file', new Blob([bytes], { type }), filename)

    const response = await fetch(session.uploadUrl.replace('{accountId}', accountId), {
        method: 'POST',
        headers: authHeaders(username, password),
        body: formData,
    })

    if (!response.ok) {
        throw new Error(`Attachment upload failed (${response.status}).`)
    }

    return response.json() as Promise<{ blobId: string, size: number, type: string }>
}

export async function storeSentMessage(params: {
    username: string
    password: string
    from: MailAddress
    to: MailAddress[]
    cc?: MailAddress[]
    bcc?: MailAddress[]
    replyTo?: MailAddress[]
    subject: string
    textBody: string
    htmlBody?: string
    attachments?: Array<{ blobId: string, name: string, type: string, size: number }>
}) {
    const { username, password, from, to, cc = [], bcc = [], replyTo = [], subject, textBody, htmlBody, attachments = [] } = params
    const { session, accountId } = await getMailSession(username, password)

    const sentMailboxId = await ensureMailbox(username, password, 'Sent', 'sent')
    const createId = `sent-${Date.now()}`
    const bodyValues: Record<string, { value: string }> = {
        text: { value: normalizeMessageText(textBody || '') }
    }
    const create: Record<string, unknown> = {
        from: [from],
        to,
        cc,
        bcc,
        replyTo,
        subject,
        keywords: { '$seen': true },
        mailboxIds: sentMailboxId ? { [sentMailboxId]: true } : undefined,
        textBody: [{ partId: 'text', type: 'text/plain' }],
        bodyValues,
    }

    if (htmlBody) {
        bodyValues.html = { value: htmlBody }
        create.htmlBody = [{ partId: 'html', type: 'text/html' }]
    }

    if (attachments.length) {
        create.attachments = attachments.map(attachment => ({
            blobId: attachment.blobId,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            disposition: 'attachment',
        }))
    }

    const result = await jmapCall<{ created?: Record<string, { id: string }> }>(username, password, session, [
        ['Email/set', { accountId, create: { [createId]: create } }, 'email-create']
    ])

    return {
        sentMailboxId,
        sentMessageId: result.created?.[createId]?.id || null,
    }
}

export async function downloadBlob(username: string, password: string, blobId: string, name: string) {
    const { session, accountId } = await getMailSession(username, password)
    const url = session.downloadUrl
        .replace('{accountId}', accountId)
        .replace('{blobId}', encodeURIComponent(blobId))
        .replace('{name}', encodeURIComponent(name))
        .replace('{type}', '*/*')

    const response = await fetch(url, { headers: authHeaders(username, password) })
    if (!response.ok) {
        throw new Error(`Unable to fetch blob (${response.status}).`)
    }

    return response
}

export async function listInboxMessagesForFiltering(username: string, password: string, mailboxId: string) {
    return listMessages(username, password, mailboxId, 100)
}

export async function getSieveScript(_username: string, _password: string) {
    return null
}

async function getEmailsByIds(username: string, password: string, session: JmapSession, accountId: string, ids: string[]) {
    const response = await jmapCall<{ list?: EmailRecord[] }>(username, password, session, [
        ['Email/get', {
            accountId,
            ids,
            properties: ['id', 'threadId', 'mailboxIds', 'keywords', 'subject', 'preview', 'receivedAt', 'sentAt', 'from', 'to', 'cc', 'bcc', 'replyTo', 'hasAttachment', 'attachments', 'textBody', 'htmlBody', 'bodyValues'],
            fetchAllBodyValues: true,
        }, 'emails']
    ])

    return response.list || []
}

async function jmapCall<T = any>(username: string, password: string, session: JmapSession, methodCalls: Array<[string, Record<string, unknown>, string]>, using: string[] = [CORE, MAIL]) {
    const response = await fetch(toApiUrl(session.apiUrl), {
        method: 'POST',
        headers: {
            ...authHeaders(username, password),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ using, methodCalls }),
    })

    if (!response.ok) {
        throw new Error(`JMAP request failed (${response.status}).`)
    }

    const payload = await response.json() as { methodResponses?: Array<[string, T, string]> }
    return payload.methodResponses?.[payload.methodResponses.length - 1]?.[1] as T
}

function toApiUrl(apiUrl: string) {
    try {
        const url = new URL(apiUrl)
        url.protocol = new URL(mailConfig.internalUrl).protocol
        url.host = new URL(mailConfig.internalUrl).host
        return url.toString()
    } catch {
        return new URL('/jmap/', ensureTrailingSlash(mailConfig.internalUrl)).toString()
    }
}

function authHeaders(username: string, password: string) {
    return {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        Accept: 'application/json',
    }
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}

function toSummary(record: EmailRecord): MailMessageSummary {
    const keywords = record.keywords || {}
    return {
        id: record.id,
        threadId: record.threadId,
        mailboxIds: Object.keys(record.mailboxIds || {}),
        subject: record.subject || '(No subject)',
        preview: record.preview || '',
        receivedAt: record.receivedAt || '',
        sentAt: record.sentAt || '',
        from: record.from || [],
        to: record.to || [],
        cc: record.cc || [],
        hasAttachment: Boolean(record.hasAttachment || record.attachments?.length),
        isRead: Boolean(keywords.$seen),
        isFlagged: Boolean(keywords.$flagged),
        isAnswered: Boolean(keywords.$answered),
        isDraft: Boolean(keywords.$draft),
        isJunk: Boolean(keywords.$junk),
        isDeleted: Boolean(keywords.$deleted),
    }
}

function toMessage(record: EmailRecord): MailMessage {
    const summary = toSummary(record)
    const attachments: MailAttachment[] = (record.attachments || []).map(attachment => ({
        blobId: attachment.blobId,
        name: attachment.name || 'attachment',
        type: attachment.type || 'application/octet-stream',
        size: attachment.size || 0,
        disposition: attachment.disposition,
        cid: attachment.cid || null,
        isInline: attachment.disposition === 'inline' || Boolean(attachment.cid),
    }))

    const htmlId = record.htmlBody?.[0]?.partId
    const textId = record.textBody?.[0]?.partId
    const htmlBody = htmlId ? record.bodyValues?.[htmlId]?.value || '' : ''
    const textBody = textId ? record.bodyValues?.[textId]?.value || '' : normalizeMessageText(stripHtml(htmlBody || record.preview || ''))

    return {
        ...summary,
        replyTo: record.replyTo || [],
        bcc: record.bcc || [],
        attachments,
        textBody: normalizeMessageText(textBody),
        htmlBody,
    }
}
