import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    const { name, owner, created_by, access_users } = req.body as {
        name: string
        owner: string
        created_by: string
        access_users?: string[]
    } ?? {}

    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const result = await run(
            "INSERT INTO vms (name, owner, created_by, access_users) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, owner, created_by, access_users || null]
        )

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
