import { queryOnce } from '#db'

export default async function ensureSocialAuthSchema() {
    await queryOnce(`CREATE TABLE IF NOT EXISTS social_auth_transactions (
        state_hash TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
        binding_hash TEXT NOT NULL,
        nonce TEXT NOT NULL,
        verifier TEXT NOT NULL,
        redirect_path TEXT NOT NULL,
        link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
    )`)
    await queryOnce('CREATE INDEX IF NOT EXISTS social_auth_transactions_expiry ON social_auth_transactions(expires_at)')
    await queryOnce(`CREATE TABLE IF NOT EXISTS user_social_identities (
        provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
        subject TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        PRIMARY KEY (provider, subject),
        UNIQUE (user_id, provider)
    )`)
}
