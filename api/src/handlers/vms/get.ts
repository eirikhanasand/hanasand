import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts';

export default async function getVM(req: FastifyRequest, res: FastifyReply) {
    const { id, user } = req.params as { id?: string; user?: string }

    try {
        let result
        if (id) {
            const query = await loadSQL('getVmById.sql')
            result = await run(query, [id])
        } else if (user) {
            const query = await loadSQL('getVmsByUser.sql')
            result = await run(query, [user])
        } else {
            const query = await loadSQL('getFullVmList.sql')
            result = await run(query)
        }

        if (result.rows.length === 0) {
            if (id) {
                return res.status(404).send({ error: "VM not found" })
            }

            return res.status(200).send([])
        }

        return res.send(result.rows)
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
