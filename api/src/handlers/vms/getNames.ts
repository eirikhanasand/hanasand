import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'

export default async function getVMNames(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run('SELECT name FROM vms;')
        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(result.rows.map((vm) => vm.name))
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
