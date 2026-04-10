import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'

export default async function shutdownVMs(req: FastifyRequest, res: FastifyReply) {
    const { vms } = req.body as { vms: string[] } ?? {}
    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!vms || !Array.isArray(vms) || vms.length === 0) {
        return res.status(400).send({ error: "Missing required 'vms' array" })
    }

    try {
        const query = `
            INSERT INTO vm_shutdown (name, "time")
            SELECT unnest($1::text[]) AS name, NOW() + INTERVAL '20 minutes'
            ON CONFLICT (name) DO UPDATE
            SET "time" = NOW() + INTERVAL '20 minutes'
            RETURNING *
        `

        const result = await run(query, [vms])
        return res.status(201).send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
