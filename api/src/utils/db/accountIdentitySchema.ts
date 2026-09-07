import { queryOnce } from '#db'

export default async function ensureAccountIdentitySchema() {
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT')
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT')
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ')
    await queryOnce('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (lower(COALESCE(username,id)))')
    await queryOnce('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email)) WHERE email IS NOT NULL')
}
