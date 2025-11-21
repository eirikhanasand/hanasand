import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export default async function deleteSelf(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const id = req.headers['id']
    if (!id || Array.isArray(id)) {
        return res.status(400).send({ error: 'No user provided.' })
    }

    try {
        const userResult = await run(`DELETE FROM users WHERE id = $1 RETURNING *`, [id])
        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        const user: User = userResult.rows[0]
        return res.send({ message: 'User deleted successfully.', user })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
