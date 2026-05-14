import run from '#db'
import { mailConfig } from './config.ts'
import { encryptMailSecret, generateMailSecret, tryDecryptMailSecret } from './crypto.ts'
import { addressForUser, addressesForUser, mailboxLocalPartForUser } from './helpers.ts'
import { type AdminPatch, createPrincipal, ensureSetting, findPrincipalByName, patchPrincipal } from './stalwartAdmin.ts'

type UserRow = {
    id: string
    name: string
}

type MailAccountRow = {
    user_id: string
    mail_username: string
    mail_address: string
    mail_password_encrypted: string
    principal_id: number | null
}

export async function ensureMailInfrastructure() {
    await ensureSetting('server.hostname', mailConfig.host)
    await ensureSetting('http.url', `https://${mailConfig.host}`)
    await ensureSetting('spam-filter.auto-update', true)
    await ensureSetting('spam-filter.bayes.account.enable', true)
    await ensureDomainPrincipal()
}

export async function provisionExistingMailAccounts() {
    await ensureMailInfrastructure()
    const users = await run('SELECT id, name FROM users WHERE active = TRUE ORDER BY id ASC')
    for (const user of users.rows as UserRow[]) {
        await ensureMailAccountForUser(user.id, user.name).catch(error => {
            console.error(`Failed to provision mail account for ${user.id}`, error)
        })
    }
}

export async function ensureMailAccountForUser(userId: string, displayName: string, preferredSecret?: string) {
    await ensureDomainPrincipal()
    const existing = await getMailAccount(userId)
    const username = mailboxLocalPartForUser(userId)
    const address = addressForUser(userId)
    const allAddresses = addressesForUser(userId)
    const principal = await findPrincipalByName(username, 'individual')
    const inheritedSecret = principal?.secrets?.find(secret => !secret.startsWith('otpauth://')) || null
    const storedSecret = existing ? getStoredMailSecret(existing) : null
    const secret = preferredSecret
        || storedSecret
        || inheritedSecret
        || generateMailSecret()

    const principalId = !principal
        ? await createPrincipal({
            type: 'individual',
            quota: 0,
            name: username,
            description: displayName,
            secrets: [secret],
            emails: allAddresses,
            urls: [],
            memberOf: [],
            roles: ['user'],
            lists: [],
            members: [],
            enabledPermissions: [],
            disabledPermissions: [],
            externalMembers: [],
        })
        : principal.id
    const storedPrincipalId = typeof principalId === 'number' ? principalId : null

    if (principal) {
        const principalEmails = new Set(principal.emails || [])
        const patches: AdminPatch[] = [
            { action: 'set', field: 'description', value: displayName },
            { action: 'set', field: 'secrets', value: [secret] },
        ]

        if (!preferredSecret && inheritedSecret && !existing) {
            patches.splice(1, 1)
        }

        await patchPrincipal(principal.name, patches)

        for (const address of allAddresses) {
            if (principalEmails.has(address)) {
                continue
            }

            await patchPrincipal(principal.name, [{ action: 'addItem', field: 'emails', value: address }])
                .catch(error => {
                    if (!isAlreadyAttachedError(error)) {
                        throw error
                    }
                })
        }
    }

    await run(`
        INSERT INTO mail_accounts (user_id, mail_username, mail_address, mail_password_encrypted, principal_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
            mail_username = EXCLUDED.mail_username,
            mail_address = EXCLUDED.mail_address,
            mail_password_encrypted = EXCLUDED.mail_password_encrypted,
            principal_id = EXCLUDED.principal_id,
        updated_at = NOW()
    `, [userId, username, address, encryptMailSecret(secret), storedPrincipalId])

    return {
        userId,
        username,
        address,
        password: secret,
        principalId: storedPrincipalId,
    }
}

export async function syncMailPasswordForUser(userId: string, displayName: string, password: string) {
    return ensureMailAccountForUser(userId, displayName, password)
}

export async function rotateMailPasswordForUser(userId: string, displayName: string) {
    return ensureMailAccountForUser(userId, displayName, generateMailSecret())
}

export async function getMailAccess(actorId: string, mailboxUser?: string) {
    const targetUser = mailboxUser || actorId
    const canAccessAnyMailbox = mailConfig.privilegedMailboxUsers.has(actorId)
    if (targetUser !== actorId && !canAccessAnyMailbox) {
        throw new Error('You do not have access to this mailbox.')
    }

    const userResult = await run('SELECT id, name FROM users WHERE id = $1', [targetUser])
    if (!userResult.rows.length) {
        throw new Error('Mailbox owner not found.')
    }

    const user = userResult.rows[0] as UserRow
    const existing = await getMailAccount(user.id)
    const storedPassword = existing ? getStoredMailSecret(existing) : null
    const account = existing && storedPassword
        ? {
            username: existing.mail_username,
            address: existing.mail_address,
            password: storedPassword,
        }
        : await ensureMailAccountForUser(user.id, user.name)

    return {
        actorId,
        targetUser: user.id,
        canAccessAnyMailbox,
        username: account.username,
        address: account.address,
        password: account.password,
    }
}

export async function listAccessibleMailAccounts(actorId: string) {
    if (mailConfig.privilegedMailboxUsers.has(actorId)) {
        const rows = await run(`
            SELECT u.id, u.name, ma.mail_address
            FROM users u
            LEFT JOIN mail_accounts ma ON ma.user_id = u.id
            WHERE u.active = TRUE
            ORDER BY u.id ASC
        `)

        return Promise.all(rows.rows.map(async (row) => {
            const user = row as UserRow & { mail_address?: string | null }
            return {
                id: user.id,
                name: user.name,
                address: user.mail_address || addressForUser(user.id),
            }
        }))
    }

    const row = await run('SELECT id, name FROM users WHERE id = $1', [actorId])
    if (!row.rows.length) {
        return []
    }

    const user = row.rows[0] as UserRow
    const account = await getMailAccount(user.id)
    return [{ id: user.id, name: user.name, address: account?.mail_address || addressForUser(user.id) }]
}

export async function getMailAccount(userId: string) {
    const result = await run('SELECT * FROM mail_accounts WHERE user_id = $1', [userId])
    return (result.rows[0] as MailAccountRow | undefined) || null
}

function getStoredMailSecret(account: MailAccountRow) {
    const secret = tryDecryptMailSecret(account.mail_password_encrypted)
    if (secret) {
        return secret
    }

    console.warn(`Ignoring undecryptable stored mail secret for ${account.user_id}; account will be resynced.`)
    return null
}

async function ensureDomainPrincipal() {
    const domain = await findPrincipalByName(mailConfig.domain, 'domain')
    if (!domain) {
        await createPrincipal({
            type: 'domain',
            quota: 0,
            name: mailConfig.domain,
            description: 'Hanasand mail domain',
            secrets: [],
            emails: [],
            urls: [],
            memberOf: [],
            roles: [],
            lists: [],
            members: [],
            enabledPermissions: [],
            disabledPermissions: [],
            externalMembers: [],
        })
    }
}

function isAlreadyAttachedError(error: unknown) {
    return error instanceof Error && error.message.includes('fieldAlreadyExists')
}
