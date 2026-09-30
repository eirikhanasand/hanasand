import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'

export default async function logoutHandler(req: FastifyRequest, res: FastifyReply) {
    const { id: suppliedId } = req.params as { id: string }
    const id = String(suppliedId || '').trim()
    const authorization = req.headers.authorization
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : ''
    res.header('Cache-Control', 'no-store')

    if (!id) {
        return res.status(400).send({ error: 'Missing userId' })
    }
    if (!token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const session = await validateSession({ id, token })
        if (!session || session.user.id !== id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        const query = `
            UPDATE tokens
            SET revoked_at = NOW(),
                revoked_by = $1
            WHERE id = $1
              AND token = $2
              AND revoked_at IS NULL
            RETURNING token_id;
        `

        const result = await run(query, [session.user.id, token])

        if (result.rowCount === 0) {
            return res.status(200).send({ message: 'No active session found.' })
        }

        return res.status(200).send({
            message: 'Session logged out successfully.',
            invalidatedTokens: result.rowCount,
        })
    } catch (error) {
        console.error(`Logout error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
