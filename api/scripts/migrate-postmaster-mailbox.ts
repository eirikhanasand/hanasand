import { createHash } from 'node:crypto'
import { getMailAccount } from '../src/utils/mail/accounts.ts'
import { mailConfig } from '../src/utils/mail/config.ts'
import { tryDecryptMailSecret } from '../src/utils/mail/crypto.ts'
import { downloadBlob, getMailboxList, jmapCall } from '../src/utils/mail/jmap.ts'
import { provisionSharedMailboxes, sharedMailAccess } from '../src/utils/mail/shared.ts'
import { findPrincipalByName, patchPrincipal } from '../src/utils/mail/stalwartAdmin.ts'

type Message = {
    id: string, blobId: string, size: number, receivedAt: string,
    mailboxIds: Record<string, boolean>, keywords: Record<string, boolean>,
    to?: { email: string }[], cc?: { email: string }[], bcc?: { email: string }[],
    'header:Delivered-To:asText'?: string, 'header:X-Original-To:asText'?: string,
}
const properties = ['id', 'blobId', 'size', 'receivedAt', 'mailboxIds', 'keywords', 'to', 'cc', 'bcc', 'header:Delivered-To:asText', 'header:X-Original-To:asText']

export function addressedTo(message: Message, address: string) {
    return [...message.to || [], ...message.cc || [], ...message.bcc || []].some(item => item.email.toLowerCase() === address.toLowerCase())
        || ['header:Delivered-To:asText', 'header:X-Original-To:asText'].some(key => {
            const value = message[key as keyof Message]
            return typeof value === 'string' && value.trim().replace(/^<|>$/g, '').toLowerCase() === address.toLowerCase()
        })
}

export async function verifyAndRemoveOriginal(params: {
    source: Message, target: Message, mailboxIds: Record<string, boolean>,
    sourceBytes: () => Promise<ArrayBuffer>, targetBytes: () => Promise<ArrayBuffer>, remove: () => Promise<void>,
}) {
    const { source, target, mailboxIds } = params
    const keys = (record: Record<string, boolean>) => Object.keys(record).filter(key => record[key]).sort().join('\n')
    if (source.size !== target.size || source.receivedAt !== target.receivedAt
        || keys(source.keywords) !== keys(target.keywords) || keys(mailboxIds) !== keys(target.mailboxIds)) {
        throw new Error(`Copy metadata verification failed for ${source.id}; original retained.`)
    }
    const digest = (bytes: ArrayBuffer) => createHash('sha256').update(Buffer.from(bytes)).digest('hex')
    if (digest(await params.sourceBytes()) !== digest(await params.targetBytes())) {
        throw new Error(`Copy content verification failed for ${source.id}; original retained.`)
    }
    await params.remove()
}

async function main() {
    const apply = process.argv.includes('--apply')
    const address = `postmaster@${mailConfig.domain}`
    const row = await getMailAccount(mailConfig.systemMailboxOwner)
    const password = row && tryDecryptMailSecret(row.mail_password_encrypted)
    if (!row || !password) throw new Error('Personal mailbox credentials are unavailable.')
    const source = await getMailboxList(row.mail_username, password)
    const adminCall = <T>(method: string, args: Record<string, unknown>) => jmapCall<T>(mailConfig.adminUser, mailConfig.adminPassword, source.session, [[method, args, 'migration']])
    const candidates: Message[] = []
    for (let position = 0;;) {
        const result = await adminCall<{ ids: string[] }>('Email/query', {
            accountId: source.accountId, position, limit: 100,
            filter: { operator: 'OR', conditions: [{ to: address }, { cc: address }, { bcc: address }, { header: ['Delivered-To', address] }, { header: ['X-Original-To', address] }] },
        })
        if (!result.ids.length) break
        const resultMessages = await adminCall<{ list: Message[], notFound: string[] }>('Email/get', { accountId: source.accountId, ids: result.ids, properties })
        if (resultMessages.notFound.length) throw new Error('Messages changed during inspection; rerun migration.')
        candidates.push(...resultMessages.list.filter(message => addressedTo(message, address)))
        position += result.ids.length
    }
    console.info(JSON.stringify({ apply, matched: candidates.length, folders: source.mailboxes.map(folder => ({ name: folder.name, messages: candidates.filter(message => message.mailboxIds[folder.id]).length })) }))
    if (!apply) return

    // Detach only the requested alias. Restore it if provisioning cannot complete.
    const owner = await findPrincipalByName(row.mail_username, 'individual')
    const hadAlias = owner?.emails?.includes(address)
    if (hadAlias) await patchPrincipal(row.mail_username, [{ action: 'removeItem', field: 'emails', value: address }])
    try {
        await provisionSharedMailboxes(['shared:postmaster'])
    } catch (error) {
        const destination = await findPrincipalByName('postmaster', 'individual')
        if (hadAlias && !destination?.emails?.includes(address)) await patchPrincipal(row.mail_username, [{ action: 'addItem', field: 'emails', value: address }])
        throw error
    }
    const access = await sharedMailAccess('shared:postmaster')
    const target = await getMailboxList(access.username, access.password)
    const folderMap = new Map<string, string>()
    for (const folder of source.mailboxes.filter(folder => candidates.some(message => message.mailboxIds[folder.id]))) {
        let id = target.mailboxes.find(item => folder.role ? item.role === folder.role : item.name === folder.name)?.id
        if (!id) {
            const created = await adminCall<{ created?: Record<string, { id: string }> }>('Mailbox/set', { accountId: target.accountId, create: { folder: { name: folder.name, role: folder.role || null } } })
            id = created.created?.folder?.id
        }
        if (!id) throw new Error(`Could not map folder ${folder.name}.`)
        folderMap.set(folder.id, id)
    }
    let moved = 0
    for (const message of candidates) {
        const mailboxIds = Object.fromEntries(Object.keys(message.mailboxIds).filter(id => message.mailboxIds[id]).map(id => {
            const targetId = folderMap.get(id)
            if (!targetId) throw new Error(`Unmapped folder ${id}.`)
            return [targetId, true]
        }))
        const copied = await adminCall<{ created?: Record<string, { id: string }>, notCreated?: Record<string, { type: string, existingId?: string }> }>('Email/copy', {
            fromAccountId: source.accountId, accountId: target.accountId, onSuccessDestroyOriginal: false,
            create: { copy: { id: message.id, mailboxIds, keywords: message.keywords, receivedAt: message.receivedAt } },
        })
        const targetId = copied.created?.copy?.id || (copied.notCreated?.copy?.type === 'alreadyExists' ? copied.notCreated.copy.existingId : null)
        if (!targetId) throw new Error(`Copy failed for ${message.id}: ${copied.notCreated?.copy?.type}; original retained.`)
        const verified = await adminCall<{ list: Message[] }>('Email/get', { accountId: target.accountId, ids: [targetId], properties })
        const destination = verified.list[0]
        if (!destination) throw new Error('Copied message is unavailable; original retained.')
        const latest = await adminCall<{ list: Message[], state: string }>('Email/get', { accountId: source.accountId, ids: [message.id], properties })
        if (!latest.list[0]) throw new Error('Original changed during migration; copied message retained.')
        await verifyAndRemoveOriginal({ source: latest.list[0], target: destination, mailboxIds,
            sourceBytes: async () => (await downloadBlob(row.mail_username, password, message.blobId, 'message.eml')).arrayBuffer(),
            targetBytes: async () => (await downloadBlob(access.username, access.password, destination.blobId, 'message.eml')).arrayBuffer(),
            remove: async () => {
                const removed = await adminCall<{ destroyed?: string[] }>('Email/set', { accountId: source.accountId, ifInState: latest.state, destroy: [message.id] })
                if (!removed.destroyed?.includes(message.id)) throw new Error(`Could not remove verified original ${message.id}.`)
            },
        })
        moved++
        if (moved % 20 === 0) console.info(`Moved and verified ${moved}/${candidates.length} Postmaster messages.`)
    }
    console.info(JSON.stringify({ moved, destination: address }))
}

if (import.meta.main) main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
