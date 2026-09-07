import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { withTransaction } from '#db'
import type { SocialProvider } from './socialOidc.ts'
import { AccountIdentityError, normalizeEmail, usernameError } from './accountIdentity.ts'

type SocialAccount = { id: string, username?: string, name: string, avatar: string | null, active: boolean, deletion_scheduled_at: string | null }

export async function socialAccount(provider: SocialProvider, identity: { subject: string, email: string | null, name?: string, authoritativeEmail?: boolean }) {
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`social:${provider}:${identity.subject}`])
        const existing = await query(`SELECT u.id,u.name,u.avatar,u.active,u.deletion_scheduled_at
            FROM user_social_identities s JOIN users u ON u.id=s.user_id WHERE s.provider=$1 AND s.subject=$2`, [provider, identity.subject])
        const account = existing.rows[0] as SocialAccount | undefined
        if (account) return account.active && !account.deletion_scheduled_at ? account : null

        const email = normalizeEmail(identity.email)
        if (!email) throw new AccountIdentityError('A verified email address is required. Choose a Google account that provides one.')
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`email:${email}`])
        const matches = await query('SELECT id,name,avatar,active,deletion_scheduled_at,email_verified_at FROM users WHERE lower(email)=$1 FOR UPDATE', [email])
        const matched = matches.rows[0]
        if (matched) {
            if (!matched.active || matched.deletion_scheduled_at) return null
            // Never attach a provider to an unverified signup or a third-party email
            // for which Google is not the authoritative identity provider.
            if (!matched.email_verified_at || !identity.authoritativeEmail) throw new AccountIdentityError('An account already uses this email. Sign in to that account and connect Google under Profile → Account.')
            const connected = await query('SELECT 1 FROM user_social_identities WHERE user_id=$1 AND provider=$2', [matched.id, provider])
            if (connected.rows.length) throw new AccountIdentityError('This account already has a different Google connection. Sign in to the existing account.')
            await query('INSERT INTO user_social_identities (provider,subject,user_id,email) VALUES ($1,$2,$3,$4)', [provider, identity.subject, matched.id, email])
            return matched as SocialAccount
        }

        const id = `user-${randomUUID()}`
        const name = identity.name?.trim().slice(0, 100) || email.split('@')[0]
        let base = email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 30)
        if (usernameError(base)) base = 'member'
        let username = base
        // Serialize usernames independently of email to resolve concurrent collisions.
        for (let attempt = 0; ; attempt++) {
            if (attempt > 20) throw new AccountIdentityError('Unable to choose an available username. Please try again.')
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`username:${username}`])
            const taken = await query('SELECT 1 FROM users WHERE lower(COALESCE(username,id))=$1 OR lower(id)=$1', [username])
            if (!taken.rows.length) break
            username = `${base}-${randomUUID().slice(0, 6)}`
        }
        const password = await bcrypt.hash(randomUUID() + randomUUID(), 10)
        const created = await query(`INSERT INTO users (id,name,password,avatar,username,email,email_verified_at) VALUES ($1,$2,$3,'',$4,$5,NOW())
            RETURNING id,name,username,avatar,active,deletion_scheduled_at`, [id, name, password, username, email])
        await query('INSERT INTO user_roles (user_id,role_id,assigned_by) VALUES ($1,\'users\',\'administrator\')', [id])
        await query('INSERT INTO user_social_identities (provider,subject,user_id,email) VALUES ($1,$2,$3,$4)', [provider, identity.subject, id, email])
        return created.rows[0] as SocialAccount
    })
}
