import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { listSessions, revokeAllTokens, revokeToken } from '#utils/auth/session.ts'

function bearerToken(req: FastifyRequest) {
    const authHeader = req.headers['authorization']
    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : undefined
}

export async function getSessions(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const sessions = await listSessions(id)
    return res.send({
        sessions: sessions.map(session => ({
            ...session,
            current: session.revoked_at === null && bearerToken(req) === undefined ? false : undefined,
        })),
    })
}

export async function revokeSession(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { token_id } = req.params as { token_id: string }
    const revoked = await revokeToken({ tokenId: Number(token_id), userId: id, revokedBy: id })
    return res.send({ revoked, token_id: Number(token_id) })
}

export async function revokeSessions(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { keep_current = true } = req.body as { keep_current?: boolean } ?? {}
    const count = await revokeAllTokens({ userId: id, revokedBy: id, exceptToken: keep_current ? bearerToken(req) : undefined })
    return res.send({ revoked: count })
}
