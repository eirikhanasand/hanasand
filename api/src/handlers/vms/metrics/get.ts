import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { vmViewer, requireVmAccess } from '#utils/vms/access.ts'

export default async function getVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { id, name } = req.params as { id?: string; name?: string }
    const viewer = id || name ? await requireVmAccess(req, res, (id || name)!) : await vmViewer(req, res)
    if (!viewer) return

    try {
        let result

        if (id) {
            result = await run('SELECT * FROM vm_metrics WHERE name = $1 ORDER BY created_at DESC', [id])
        } else if (name) {
            result = await run('SELECT * FROM vm_metrics WHERE name = $1 ORDER BY created_at DESC', [name])
        } else {
            result = viewer.admin
                ? await run('SELECT * FROM vm_metrics ORDER BY created_at DESC')
                : await run('SELECT m.* FROM vm_metrics m JOIN vms v ON LOWER(v.name) = LOWER(m.name) WHERE v.owner = $1 OR v.created_by = $1 OR v.access_users ? $1 ORDER BY m.created_at DESC', [viewer.id])
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
