import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

export default async function shutdownVMs(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    const { vms } = req.body as { vms: string[] } ?? {}
    if (!token || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!vms || !Array.isArray(vms) || vms.length === 0) {
        return res.status(400).send({ error: "Missing required 'vms' array" })
    }

    try {
        const values: string[] = []
        const params: any[] = []

        vms.forEach((vm, idx) => {
            const paramIndex = idx + 1
            values.push(`($${paramIndex})`)
            params.push(vm)
        })

        const query = `
            INSERT INTO vm_shutdown (name, "time")
            VALUES ${values.join(', ')}
            ON CONFLICT (name) DO UPDATE
            SET "time" = NOW() + INTERVAL '20 minutes'
            RETURNING *
        `

        const result = await run(query, params)
        return res.status(201).send(result.rows)
    } catch (error) {
        console.error(error)
        res.status(500).send({ error: "Internal server error" })
    }
}
