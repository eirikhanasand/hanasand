import { queryOnce } from '#db'

export default async function ensureServiceAccountsSchema() {
    // Existing creation dates are unknown; only new accounts get a default date.
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT \'user\'')
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ')
    await queryOnce('ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW()')
    await queryOnce('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ')
    await queryOnce(`UPDATE users u SET last_login_at = e.last_login
        FROM (SELECT user_id, MAX(created_at) AS last_login FROM login_events WHERE status = 'success' GROUP BY user_id) e
        WHERE u.id = e.user_id AND u.last_login_at IS NULL`)
}
