import { expect, test } from 'bun:test'
import { mailConfig } from '../src/utils/mail/config.ts'
import { addressesForUser } from '../src/utils/mail/helpers.ts'
import { addressedTo, verifyAndRemoveOriginal } from '../scripts/migrate-postmaster-mailbox.ts'

const message = { id: 'source', blobId: 'blob', size: 4, receivedAt: '2026-09-20T00:00:00Z', mailboxIds: { inbox: true }, keywords: { $seen: true }, to: [{ email: 'postmaster@hanasand.com' }] }
const bytes = async () => new TextEncoder().encode('mail').buffer

test('matches exact Postmaster recipients, not report subjects or other recipients', () => {
    expect(addressedTo(message, 'postmaster@hanasand.com')).toBe(true)
    expect(addressedTo({ ...message, to: [{ email: 'not-postmaster@hanasand.com' }] }, 'postmaster@hanasand.com')).toBe(false)
    expect(addressedTo({ ...message, to: [], 'header:Delivered-To:asText': '<POSTMASTER@hanasand.com>' }, 'postmaster@hanasand.com')).toBe(true)
})

test('removes originals only after content, flags, date and destination folders verify', async () => {
    let removed = 0
    const target = { ...message, id: 'copy', mailboxIds: { destination: true } }
    const params = { source: message, target, mailboxIds: { destination: true }, sourceBytes: bytes, targetBytes: bytes, remove: async () => { removed++ } }
    await verifyAndRemoveOriginal(params)
    expect(removed).toBe(1)
    for (const bad of [{ size: 5 }, { receivedAt: 'changed' }, { keywords: {} }, { mailboxIds: { wrong: true } }]) {
        await expect(verifyAndRemoveOriginal({ ...params, target: { ...target, ...bad } })).rejects.toThrow('original retained')
    }
    await expect(verifyAndRemoveOriginal({ ...params, targetBytes: async () => new TextEncoder().encode('oops').buffer })).rejects.toThrow('original retained')
    expect(removed).toBe(1)
})

test('legacy Postmaster alias configuration cannot reattach it to the personal mailbox', () => {
    expect(mailConfig.systemAliasLocalParts.map(value => value.toLowerCase())).not.toContain('postmaster')
    expect(addressesForUser(mailConfig.systemMailboxOwner)).not.toContain(`postmaster@${mailConfig.domain}`)
})
