import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { listHostUpdateHistory, persistHostUpdateStatus, readHostUpdateStatus } from '#utils/aptUpdates.ts'

async function requireSystemAdmin(req: FastifyRequest, res: FastifyReply) {
    const access = await tokenWrapper(req, res)
    if (!access.valid) {
        res.status(401).send({ error: access.error || 'Unauthorized.' })
        return false
    }
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return false
    }
    return true
}

export async function getAptUpdates(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    const { status, runId } = await readHostUpdateStatus()
    await persistHostUpdateStatus(status, runId)
    return res.send({ host: 'hanasand', status, history: await listHostUpdateHistory() })
}
