import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { vmViewer } from '#utils/vms/access.ts'

export default async function assignVmOrganization(req: FastifyRequest, res: FastifyReply) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return
    const { id } = req.params as { id: string }
    const organizationId = (req.body as { organizationId?: unknown } | undefined)?.organizationId
    if (typeof organizationId !== 'string' || !organizationId.trim()) return res.status(400).send({ error: 'Choose an organization.' })
    const result = await withTransaction(async query => {
        const vm = (await query('SELECT * FROM vms WHERE name = $1 FOR UPDATE', [id])).rows[0]
        if (!vm || (!viewer.admin && vm.owner !== viewer.id)) return { status: 404, error: 'Personal VM not found.' }
        if (vm.deleted_at || vm.organization_id) return { status: 409, error: 'Only a personal VM that is not scheduled for deletion can be added.' }
        const org = (await query(`SELECT o.id, o.name FROM organizations o JOIN organization_members m ON m.organization_id = o.id
            WHERE o.id = $1 AND o.status = 'active' AND m.user_id = $2 AND m.status = 'active' AND m.role IN ('owner', 'admin', 'member')
            FOR SHARE OF o, m`, [organizationId, viewer.id])).rows[0]
        if (!org) return { status: 403, error: 'Join this organization as a member before adding a VM.' }
        await query('UPDATE vms SET organization_id = $2, access_users = \'[]\'::jsonb WHERE name = $1', [id, org.id])
        await query(`INSERT INTO system_events (event_type, actor_id, object_type, object_id, organization_id, source, service, outcome, reason)
            VALUES ('vm.organization_assigned', $1, 'vm', $2, $3, 'api', 'hanasand-api', 'success', 'VM access now follows organization membership')`, [viewer.id, id, org.id])
        return { status: 200, organization: org }
    })
    return res.status(result.status).send(result)
}
