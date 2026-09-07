import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { withTransaction } from '#db'
import type { SocialProvider } from './socialOidc.ts'

type SocialAccount = { id: string, name: string, avatar: string | null, active: boolean, deletion_scheduled_at: string | null }

export async function socialAccount(provider: SocialProvider, identity: { subject: string, email: string | null, name?: string }) {
    return withTransaction(async query => {
        // Serialize first sign-ins for the same provider identity across workers.
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`social:${provider}:${identity.subject}`])
        const existing = await query(`SELECT u.id,u.name,u.avatar,u.active,u.deletion_scheduled_at
            FROM user_social_identities s JOIN users u ON u.id=s.user_id WHERE s.provider=$1 AND s.subject=$2`, [provider, identity.subject])
        const account = existing.rows[0] as SocialAccount | undefined
        if (account) return account.active && !account.deletion_scheduled_at ? account : null

        // Names/emails never claim another user's account or determine permissions.
        const id = `user-${randomUUID()}`
        const name = identity.name?.trim().slice(0, 100) || identity.email?.split('@')[0] || `${provider === 'google' ? 'Google' : 'Apple'} user`
        const password = await bcrypt.hash(randomUUID() + randomUUID(), 10)
        const created = await query(`INSERT INTO users (id,name,password,avatar) VALUES ($1,$2,$3,'')
            RETURNING id,name,avatar,active,deletion_scheduled_at`, [id, name, password])
        await query('INSERT INTO user_roles (user_id,role_id,assigned_by) VALUES ($1,\'users\',\'administrator\')', [id])
        await query('INSERT INTO user_social_identities (provider,subject,user_id,email) VALUES ($1,$2,$3,$4)', [provider, identity.subject, id, identity.email])
        return created.rows[0] as SocialAccount
    })
}
