import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

export default async function getVMNames(req: FastifyRequest, res: FastifyReply) {
    const token = req.headers['Authorization']
    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run('SELECT name FROM vms;')
        if (result.rows.length === 0) {
            return res.status(404).send({ error: "No VMs found." })
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
