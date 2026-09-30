import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withDatabaseAdvisoryLock } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { applyManagedHostSshKeys, hostConsoleNames, normalizeHostPublicKey } from '#utils/hostSsh.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

type HostSshKey = { id: string, name: string, public_key: string, fingerprint: string, created_at: string }

async function authorize(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const access = await tokenWrapper(req, res)
    if (!access.valid || !access.id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    if (!(await hasRole(req, res, 'system_admin')).valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return null
    }
    return access.id
}

async function currentKeys() {
    const result = await run('SELECT id, name, public_key, fingerprint, created_at FROM host_ssh_keys ORDER BY created_at DESC, id DESC')
    return result.rows as HostSshKey[]
}

function responseKey(key: HostSshKey) {
    return { id: key.id, name: key.name, publicKey: key.public_key, fingerprint: key.fingerprint, createdAt: key.created_at }
}

async function audit(req: FastifyRequest, actorId: string, actionType: string, key: Pick<HostSshKey, 'id' | 'name' | 'fingerprint'>) {
    try {
        await recordSystemEvent(req, {
            actionType,
            actorId,
            targetType: 'host_ssh_key',
            targetId: key.id,
            context: { name: key.name, fingerprint: key.fingerprint, hosts: hostConsoleNames },
        })
    } catch (error) {
        req.log.error({ err: error, keyId: key.id }, 'Unable to record host SSH key audit event.')
    }
}

export async function getHostSshKeys(req: FastifyRequest, res: FastifyReply) {
    if (!await authorize(req, res)) return
    try {
        const keys = await currentKeys()
        return res.send({ hosts: hostConsoleNames, keys: keys.map(responseKey) })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to list host SSH keys.')
        return res.status(500).send({ error: 'Unable to load SSH keys.' })
    }
}

export async function postHostSshKey(req: FastifyRequest, res: FastifyReply) {
    const actorId = await authorize(req, res)
    if (!actorId) return
    const body = (req.body || {}) as { name?: unknown, publicKey?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const key = normalizeHostPublicKey(body.publicKey)
    if (!name || name.length > 100 || !key) {
        return res.status(400).send({ error: 'Enter a name and one valid OpenSSH public key.' })
    }
    try {
        return await withDatabaseAdvisoryLock('host-ssh-keys-sync', async () => {
            const previous = await currentKeys()
            if (previous.some(existing => existing.fingerprint === key.fingerprint)) {
                return res.status(409).send({ error: 'That SSH key is already listed.' })
            }
            const inserted = await run('INSERT INTO host_ssh_keys (name, public_key, fingerprint, created_by) VALUES ($1, $2, $3, $4) RETURNING id, name, public_key, fingerprint, created_at', [name, key.publicKey, key.fingerprint, actorId])
            const row = inserted.rows[0] as HostSshKey
            try {
                const next = await currentKeys()
                await applyManagedHostSshKeys(next.map(item => item.public_key))
            } catch (error) {
                await run('DELETE FROM host_ssh_keys WHERE id = $1', [row.id])
                await applyManagedHostSshKeys(previous.map(item => item.public_key)).catch(rollbackError => {
                    req.log.error({ err: rollbackError }, 'Unable to roll back a partial host SSH key update.')
                })
                req.log.error({ err: error, keyId: row.id }, 'Unable to apply a host SSH key.')
                return res.status(503).send({ error: 'Unable to apply this key on both hosts. No change was saved.' })
            }
            await audit(req, actorId, 'host.ssh_key.added', row)
            return res.status(201).send({ key: responseKey(row) })
        })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to save a host SSH key.')
        return res.status(500).send({ error: 'Unable to save this SSH key.' })
    }
}

export async function deleteHostSshKey(req: FastifyRequest, res: FastifyReply) {
    const actorId = await authorize(req, res)
    if (!actorId) return
    const { id } = req.params as { id: string }
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return res.status(400).send({ error: 'Invalid SSH key.' })
    try {
        return await withDatabaseAdvisoryLock('host-ssh-keys-sync', async () => {
            const previous = await currentKeys()
            const removing = previous.find(key => key.id === id)
            if (!removing) return res.status(404).send({ error: 'SSH key not found.' })
            const next = previous.filter(key => key.id !== id)
            try {
                await applyManagedHostSshKeys(next.map(item => item.public_key))
            } catch (error) {
                await applyManagedHostSshKeys(previous.map(item => item.public_key)).catch(rollbackError => {
                    req.log.error({ err: rollbackError }, 'Unable to roll back a partial host SSH key removal.')
                })
                req.log.error({ err: error, keyId: id }, 'Unable to remove a host SSH key.')
                return res.status(503).send({ error: 'Unable to remove this key from both hosts. No change was saved.' })
            }
            try {
                await run('DELETE FROM host_ssh_keys WHERE id = $1', [id])
            } catch (error) {
                await applyManagedHostSshKeys(previous.map(item => item.public_key)).catch(rollbackError => {
                    req.log.error({ err: rollbackError }, 'Unable to restore a host SSH key after a database failure.')
                })
                throw error
            }
            await audit(req, actorId, 'host.ssh_key.removed', removing)
            return res.send({ ok: true })
        })
    } catch (error) {
        req.log.error({ err: error, keyId: id }, 'Unable to delete a host SSH key.')
        return res.status(500).send({ error: 'Unable to remove this SSH key.' })
    }
}
