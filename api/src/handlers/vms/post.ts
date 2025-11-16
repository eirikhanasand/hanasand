import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const token = req.headers['Authorization']
    const { user, vm_ip, created_by, access_users } = req.body as {
        user: string
        vm_ip: string
        created_by: string
        access_users?: string[]
    }

    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!user || !vm_ip || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const result = await run(
            "INSERT INTO vms (user, vm_ip, created_by, access_users) VALUES ($1, $2, $3, $4) RETURNING *",
            [user, vm_ip, created_by, access_users || []]
        )

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
