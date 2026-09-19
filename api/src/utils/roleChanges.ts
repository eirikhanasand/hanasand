import type { FastifyRequest } from 'fastify'
import { withTransaction } from './db.ts'
import { recordSystemEvent } from './systemEvent.ts'

export class RoleChangeError extends Error {
    constructor(public status: number, message: string) { super(message) }
}

export type RoleChanges = { name?: string, description?: string, priority?: number, icon?: string | null }

export function validateRoleChanges(body: unknown, creating = false): RoleChanges {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RoleChangeError(400, 'Invalid role details.')
    const fields = body as Record<string, unknown>
    const allowed = ['name', 'description', 'priority', 'icon', ...(creating ? ['id', 'created_by'] : [])]
    if (Object.keys(fields).some(key => !allowed.includes(key))) throw new RoleChangeError(400, 'Unsupported role field.')
    const changes: RoleChanges = {}
    if (creating || fields.name !== undefined) {
        if (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 120) throw new RoleChangeError(400, 'Name must contain 1–120 characters.')
        changes.name = fields.name.trim()
    }
    if (fields.description !== undefined) {
        if (typeof fields.description !== 'string' || fields.description.length > 2000) throw new RoleChangeError(400, 'Description must be at most 2000 characters.')
        changes.description = fields.description.trim()
    }
    if (fields.priority !== undefined) {
        if (!Number.isInteger(fields.priority) || Number(fields.priority) < 0 || Number(fields.priority) > 2147483647) throw new RoleChangeError(400, 'Priority must be a whole number between 1 and 2147483647. Zero is reserved for Administrator.')
        changes.priority = fields.priority as number
    }
    if (fields.icon !== undefined) {
        // Store only an icon identifier; the UI renders its own trusted catalog, never SVG or URLs.
        if (fields.icon !== null && (typeof fields.icon !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(fields.icon))) throw new RoleChangeError(400, 'Invalid role icon.')
        changes.icon = fields.icon as string | null
    }
    if (!Object.keys(changes).length) throw new RoleChangeError(400, 'No fields to update.')
    return changes
}

export async function saveRoleChanges(req: FastifyRequest, roleId: string, userId: string, actorId: string, changes: RoleChanges, creating = false) {
    return withTransaction(async query => {
        // Serialize priority changes so the hierarchy used for authorization cannot change mid-save.
        await query('LOCK TABLE roles IN SHARE ROW EXCLUSIVE MODE')
        const before = creating ? null : (await query('SELECT * FROM roles WHERE id = $1', [roleId])).rows[0]
        if (!creating && !before) throw new RoleChangeError(404, 'Role not found.')
        const own = (await query('SELECT min(r.priority) AS priority FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1', [userId])).rows[0]?.priority
        if (own == null || before && own > before.priority) throw new RoleChangeError(403, 'You cannot edit a role above your own priority.')
        const priority = changes.priority ?? (creating ? Math.max(1000, own) : before.priority)
        if (roleId === 'administrator' ? creating || priority !== 0 : priority < 1) throw new RoleChangeError(400, 'Administrator has a fixed priority of 0. Other roles must have a priority of at least 1.')
        if (priority < own) throw new RoleChangeError(403, 'You cannot give a role a higher priority than your own.')
        const after = creating
            ? (await query('INSERT INTO roles (id,name,description,priority,icon,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [roleId, changes.name!, changes.description || null, priority, changes.icon ?? null, userId])).rows[0]
            : (await query('UPDATE roles SET name=$2,description=$3,priority=$4,icon=$5,updated_at=NOW() WHERE id=$1 RETURNING *', [roleId, changes.name ?? before.name, changes.description ?? before.description, priority, changes.icon === undefined ? before.icon : changes.icon])).rows[0]
        const details = (role: typeof after | null) => role ? { name: role.name, description: role.description, priority: role.priority, icon: role.icon } : null
        await recordSystemEvent(req, { actionType: creating ? 'role.created' : 'role.updated', actorId, source: 'management', targetType: 'role', targetId: roleId, context: { before: details(before), after: details(after) } }, query)
        return after
    })
}
