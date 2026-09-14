import run from '#db'

export default async function ensureSharedMailSchema() {
    await run(`CREATE TABLE IF NOT EXISTS shared_mail_accounts (
        id TEXT PRIMARY KEY,
        mail_username TEXT NOT NULL UNIQUE,
        mail_address TEXT NOT NULL UNIQUE,
        mail_password_encrypted TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run(`CREATE TABLE IF NOT EXISTS shared_mail_filters (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES shared_mail_accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
        action JSONB NOT NULL DEFAULT '{}'::jsonb,
        priority INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}
