import run from '#db'

export default async function purgeDeletedAccounts() {
    await run(`
        DELETE FROM users
        WHERE deletion_scheduled_at IS NOT NULL
          AND deletion_scheduled_at <= NOW()
          AND COALESCE(reserved, FALSE) IS FALSE
    `)
}
