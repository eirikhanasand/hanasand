import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { listManagedCronJobs, updateManagedCronJob, type ManagedCronUpdate } from '#utils/systemCron.ts'

async function requireSystemAdmin(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return false
    }
    return true
}

export async function getSystemCronJobs(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    return res.send({ jobs: await listManagedCronJobs() })
}

export async function putSystemCronJob(req: FastifyRequest<{ Params: { id: string }, Body: ManagedCronUpdate }>, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    try {
        const job = await updateManagedCronJob(req.params.id, req.body || {})
        return res.send({ job, jobs: await listManagedCronJobs() })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Unable to update cron job.' })
    }
}
