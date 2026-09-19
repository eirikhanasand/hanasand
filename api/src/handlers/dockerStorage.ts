import { readFile, writeFile } from 'node:fs/promises'
import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

const root = process.env.DOCKER_STORAGE_STATE_DIR || '/var/lib/hanasand/docker-storage'
async function authorize(req: FastifyRequest, res: FastifyReply) {
    const access = await tokenWrapper(req, res)
    if (!access.valid) { res.status(401).send({ error: 'Sign in to view storage.' }); return false }
    if (!(await hasRole(req, res, 'system_admin')).valid) {
        res.status(403).send({ error: 'System administrator access is required.' }); return false
    }
    return true
}

export async function getDockerStorage(req: FastifyRequest, res: FastifyReply) {
    if (!await authorize(req, res)) return
    res.header('Cache-Control', 'no-store')
    try {
        const state = JSON.parse(await readFile(`${root}/status.json`, 'utf8'))
        const queued = await readFile(`${root}/request.json`, 'utf8').then(() => true).catch(() => false)
        const age = Date.now() - Date.parse(state.checkedAt)
        return res.send({ ...state, queued, stale: !Number.isFinite(age) || age < -5000 || age > 15 * 60_000 })
    } catch {
        return res.status(503).send({ error: 'Storage information is unavailable. Try again shortly.' })
    }
}

export async function clearDockerStorage(req: FastifyRequest, res: FastifyReply) {
    if (!await authorize(req, res)) return
    res.header('Cache-Control', 'no-store')
    if (process.env.RESILIENCE_SITE === 'ovh' || process.env.RESILIENCE_SITE === 'ovhcloud') {
        return res.status(503).send({ error: 'Inspur must be available to clear its storage.' })
    }
    try {
        // A fixed request file wakes the host service; no shell command comes from the client.
        await writeFile(`${root}/request.json`, JSON.stringify({ requestedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 })
        return res.status(202).send({ queued: true })
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return res.status(202).send({ queued: true })
        return res.status(503).send({ error: 'Cleanup could not be started. Try again shortly.' })
    }
}
