import config from '#constants'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import sanitize from '#utils/sanitize.ts'
import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

const allowedActions = new Set(['start', 'stop', 'restart'])

export default async function vmAction(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'system_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawId, action: rawAction } = req.params as { id: string, action: string }
    const id = sanitize(rawId)
    const action = sanitize(rawAction)

    if (!id || !action || !allowedActions.has(action)) {
        return res.status(400).send({ error: 'Invalid VM action.' })
    }

    try {
        const internalRes = await fetch(`${config.internal_api}/vm/${encodeURIComponent(id)}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'User-Agent': 'hanasand_internal',
            },
        })

        const text = await internalRes.text()
        const payload = parseInternalPayload(text)

        if (!internalRes.ok) {
            return res.status(internalRes.status).send({
                error: describeVmActionError(payload, action, id),
                details: payload,
            })
        }

        const nextStatus = action === 'stop' ? 'stopped' : 'running'
        await run(`
            UPDATE vm_details
            SET status = $2,
                volatile_last_state_power = UPPER($2),
                last_checked = NOW()
            WHERE name = $1
        `, [id, nextStatus]).catch((error) => {
            req.log.warn({ err: error, id, action }, 'Unable to update cached VM status after action.')
        })

        return res.send(payload)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to contact internal VM API.' })
    }
}

function parseInternalPayload(text: string) {
    if (!text) {
        return {}
    }

    try {
        return JSON.parse(text) as Record<string, unknown>
    } catch {
        return { error: text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Internal VM API returned an unreadable response.' }
    }
}

function describeVmActionError(payload: Record<string, unknown>, action: string, id: string) {
    const error = typeof payload.error === 'string' ? payload.error : ''
    const stderr = typeof payload.stderr === 'string' ? payload.stderr : ''
    const detail = error || stderr || 'No details returned.'
    return `Unable to ${action} virtual machine ${id}: ${detail}`
}
