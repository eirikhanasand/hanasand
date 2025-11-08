import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export async function postVM(req: FastifyRequest, res: FastifyReply) {
    const { user, vm_ip, created_by, access_users } = req.body as {
        user: string
        vm_ip: string
        created_by: string
        access_users?: string[]
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
