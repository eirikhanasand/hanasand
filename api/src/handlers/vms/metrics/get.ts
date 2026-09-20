import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { vmViewer, requireVmAccess } from '#utils/vms/access.ts'

export default async function getVMMetrics(req: FastifyRequest, res: FastifyReply) {
    const { id, name } = req.params as { id?: string; name?: string }
    const viewer = id || name ? await requireVmAccess(req, res, (id || name)!) : await vmViewer(req, res)
    if (!viewer) return

    try {
        let result

        if (id) {
            result = await run('SELECT * FROM vm_metrics WHERE name = $1 ORDER BY created_at DESC LIMIT 120', [id])
        } else if (name) {
            result = await run('SELECT * FROM vm_metrics WHERE name = $1 ORDER BY created_at DESC LIMIT 120', [name])
        } else {
            result = viewer.admin
                ? await run(await loadSQL('getLatestVmMetrics.sql'))
                : await run('SELECT m.* FROM vms v JOIN LATERAL (SELECT * FROM vm_metrics WHERE name = v.name ORDER BY created_at DESC LIMIT 1) m ON TRUE WHERE vm_user_has_access(v.name, $1) ORDER BY m.name', [viewer.id])
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
