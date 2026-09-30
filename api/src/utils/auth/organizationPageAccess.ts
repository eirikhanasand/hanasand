import run from '#db'
import { canViewHanasandInternalPages, HANASAND_ORGANIZATION_ID } from './organizationPagePolicy.ts'

export { canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID } from './organizationPagePolicy.ts'

export async function hasHanasandInternalPageAccess(userId: string) {
    const result = await run(`
        SELECT organization.id AS organization_id,
               organization.status AS organization_status,
               member.status AS membership_status,
               member.role
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        JOIN users ON users.id = member.user_id
        WHERE member.user_id = $1
          AND organization.id = $2
          AND users.active IS TRUE
          AND users.deletion_scheduled_at IS NULL
        LIMIT 1
    `, [userId, HANASAND_ORGANIZATION_ID])

    return result.rows.some(row => canViewHanasandInternalPages({
        organizationId: row.organization_id,
        organizationStatus: row.organization_status,
        membershipStatus: row.membership_status,
        role: row.role,
    }))
}
