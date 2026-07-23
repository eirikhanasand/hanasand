import run from '#db'

export default async function purgeDeletedAccounts() {
    await run(`
        WITH due_users AS MATERIALIZED (
            SELECT id
            FROM users
            WHERE deletion_scheduled_at IS NOT NULL
              AND deletion_scheduled_at <= NOW()
              AND COALESCE(reserved, FALSE) IS FALSE
        ), deleted_tokens AS (
            DELETE FROM tokens WHERE id IN (SELECT id FROM due_users)
        ), scrubbed_token_revocations AS (
            UPDATE tokens
            SET revoked_by = NULL
            WHERE revoked_by IN (SELECT id FROM due_users)
              AND id NOT IN (SELECT id FROM due_users)
        ), deleted_login_events AS (
            DELETE FROM login_events WHERE user_id IN (SELECT id FROM due_users)
        ), deleted_attempts AS (
            DELETE FROM attempts WHERE id IN (SELECT id FROM due_users)
        ), deleted_unbound_api_keys AS (
            DELETE FROM api_keys
            WHERE owner_id IN (SELECT id FROM due_users)
              AND organization_id IS NULL
        )
        DELETE FROM users WHERE id IN (SELECT id FROM due_users)
    `)
}
