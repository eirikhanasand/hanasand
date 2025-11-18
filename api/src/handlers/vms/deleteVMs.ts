import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

export default async function deleteVMs(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    const { vms } = req.body as { vms: string[] } ?? {}
    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!vms) {
        return res.status(400).send({ error: "Missing vms to delete." })
    }

    try {
        const result = await run('DELETE FROM vms WHERE name = ANY($1) RETURNING *', [vms])
        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
