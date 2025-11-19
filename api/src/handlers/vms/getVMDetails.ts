import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export default async function getVMDetails(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { name } = req.params as { name: string }
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run('SELECT * FROM vm_details WHERE name = $1;', [name])
        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(result.rows[0])
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
