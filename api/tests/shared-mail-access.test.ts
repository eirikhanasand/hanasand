import { expect, mock, test } from 'bun:test'
let internalMember = false
let mailboxReads = 0
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => {
    if (sql.includes('shared_mail_accounts')) { mailboxReads++; return { rows: [{ mail_username: 'support', mail_address: 'support@example.test', mail_password_encrypted: 'encrypted' }] } }
    if (sql.includes('SELECT id, name FROM users')) return { rows: [{ id: 'member', name: 'Member' }] }
    if (sql.includes('FROM mail_accounts')) return { rows: [{ mail_username: 'member', mail_address: 'member@example.test', mail_password_encrypted: 'encrypted' }] }
    return { rows: [] }
} }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ hasHanasandInternalPageAccess: async () => internalMember }))
mock.module('../src/utils/mail/config.ts', () => ({ requireMailAdminConfig: () => { throw new Error('unused') }, mailConfig: { domain: 'example.test', systemSenderLocalPart: 'noreply', userAliases: new Map() } }))
mock.module('../src/utils/mail/crypto.ts', () => ({ tryDecryptMailSecret: () => 'test-secret', encryptMailSecret: () => 'encrypted', generateMailSecret: () => 'test-secret' }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ createPrincipal: () => { throw new Error('Unexpected provisioning') }, findPrincipalByName: () => null, patchPrincipal: () => {}, setDomainCatchAllAddress: () => {}, ensureSetting: () => {} }))
mock.module('../src/utils/mail/system.ts', () => ({ systemSenderAccess: () => ({ username: 'noreply', address: 'noreply@example.test', password: 'test-secret' }) }))
const { getMailAccess, listAccessibleMailAccounts } = await import('../src/utils/mail/accounts.ts')

test('personal users cannot enumerate or open shared mailboxes or another user mailbox', async () => {
    internalMember = false
    mailboxReads = 0
    expect((await listAccessibleMailAccounts('member')).map(account => account.id)).toEqual(['member'])
    await expect(getMailAccess('member', 'shared:postmaster')).rejects.toThrow('do not have access')
    await expect(getMailAccess('member', 'shared:security')).rejects.toThrow('do not have access')
    await expect(getMailAccess('member', 'shared:support')).rejects.toThrow('do not have access')
    await expect(getMailAccess('member', 'someone-else')).rejects.toThrow('do not have access')
    expect(mailboxReads).toBe(0)
})

test('Hanasand organization members can open shared mailboxes but not private user inboxes', async () => {
    internalMember = true
    expect((await listAccessibleMailAccounts('member')).filter(account => account.shared).map(account => account.id)).toEqual(['shared:support', 'shared:sales', 'shared:postmaster', 'shared:security', 'shared:noreply'])
    expect(await getMailAccess('member', 'shared:support')).toMatchObject({ targetUser: 'shared:support', address: 'support@example.test', canSend: true })
    expect(await getMailAccess('member', 'shared:noreply')).toMatchObject({ canSend: false })
    await expect(getMailAccess('member', 'someone-else')).rejects.toThrow('do not have access')
    internalMember = false
    await expect(getMailAccess('member', 'shared:support')).rejects.toThrow('do not have access')
})

test('Hanasand organization members can send from noreply and unknown shared IDs are rejected', async () => {
    internalMember = true
    expect(await getMailAccess('member', 'shared:noreply')).toMatchObject({ canSend: true })
    await expect(getMailAccess('member', 'shared:unknown')).rejects.toThrow('do not have access')
})

test('Hanasand organization members cannot open private customer mailboxes even with a direct mailbox parameter', async () => {
    internalMember = true
    await expect(getMailAccess('member', 'private-user')).rejects.toThrow('do not have access')
})
