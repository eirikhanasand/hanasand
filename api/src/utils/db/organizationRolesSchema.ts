import { withTransaction } from '#db'

export default async function ensureOrganizationRolesSchema() {
    await withTransaction(async query => {
        // Keep both tables consistent, including invites accepted during a rolling upgrade.
        await query('LOCK TABLE organization_members, organization_invites IN SHARE ROW EXCLUSIVE MODE')
        for (const table of ['organization_members', 'organization_invites']) {
            const roles = table === 'organization_members'
                ? '\'owner\', \'admin\', \'editor\', \'reader\', \'member\', \'viewer\''
                : '\'admin\', \'editor\', \'reader\', \'member\', \'viewer\''
            await query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_role_check`)
            await query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_role_check CHECK (role IN (${roles}))`)
            await query(`ALTER TABLE ${table} ALTER COLUMN role SET DEFAULT 'reader'`)
            await query(`UPDATE ${table} SET role = 'reader' WHERE role IN ('member', 'viewer')`)
        }
    })
}
