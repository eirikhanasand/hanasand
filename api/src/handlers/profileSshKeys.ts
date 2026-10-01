import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withDatabaseAdvisoryLock, withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { applyManagedHostSshKeys, normalizeHostPublicKey } from '#utils/hostSsh.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

type ProfileSshKey = { id: number, name: string, public_key: string, added_at: string }
type ProfileSshKeyUsage = { fingerprint: string, last_used_at: string | Date }

async function authorizeSelf(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'private, no-store')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    if (auth.impersonating || auth.authenticatedId !== auth.id) {
        res.status(403).send({ error: 'Manage SSH keys from your own profile.' })
        return null
    }
    return auth.id
}

async function profileKeys(userId: string) {
    const result = await run(`
        SELECT c.id, c.name, c.public_key, uc.assigned_at AS added_at
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        WHERE uc.user_id = $1
        ORDER BY uc.assigned_at DESC, c.id DESC
    `, [userId])
    return result.rows as ProfileSshKey[]
}

async function profileKeyUsage(fingerprints: string[]) {
    if (!fingerprints.length) return new Map<string, string>()
    const result = await run(`
        SELECT fingerprint, MAX(event_timestamp) AS last_used_at
        FROM (
            SELECT e.event_timestamp,
                   substring(e.normalized->>'message' FROM '(SHA256:[A-Za-z0-9+/]{43})') AS fingerprint
            FROM events e
            WHERE e.organization_id = (
                SELECT id
                FROM organizations
                WHERE status = 'active'
                  AND (id = $3 OR ($3::text IS NULL AND lower(name) = 'hanasand'))
                ORDER BY created_at
                LIMIT 1
            )
              AND e.ingestion_id = 'logs'
              AND e.processing_status = 'processed'
              AND e.event_type = 'authentication'
              AND e.action = 'login'
              AND e.outcome = 'success'
              AND e.normalized->>'service' = 'sshd'
              AND e.normalized->>'host' = ANY($1::text[])
              AND e.normalized->>'message' LIKE 'Accepted publickey for % ssh2: % SHA256:%'
        ) accepted_keys
        WHERE fingerprint = ANY($2::text[])
        GROUP BY fingerprint
    `, [['inspur', 'ovhcloud'], fingerprints, process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    return new Map((result.rows as ProfileSshKeyUsage[]).map(row => [
        row.fingerprint,
        row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at,
    ]))
}

async function currentHostKeys(exclude?: { userId: string, certificateId: number }) {
    const result = await run(`
        SELECT DISTINCT c.public_key
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        JOIN users u ON u.id = uc.user_id
        WHERE u.active IS TRUE
          AND u.deletion_scheduled_at IS NULL
          ${exclude ? 'AND NOT (uc.user_id = $1 AND uc.certificate_id = $2)' : ''}
    `, exclude ? [exclude.userId, exclude.certificateId] : [])
    const byFingerprint = new Map<string, string>()
    for (const row of result.rows as Array<{ public_key: string }>) {
        const key = normalizeHostPublicKey(row.public_key)
        if (key) byFingerprint.set(key.fingerprint, key.publicKey)
    }
    return [...byFingerprint.values()]
}

async function writeAudit(req: FastifyRequest, actorId: string, actionType: string, certificateId: number, fingerprint: string) {
    try {
        await recordSystemEvent(req, {
            actionType,
            actorId,
            targetType: 'user_ssh_key',
            targetId: String(certificateId),
            context: { fingerprint, hosts: ['inspur', 'ovh'] },
        })
    } catch (error) {
        req.log.error({ err: error, certificateId }, 'Unable to record profile SSH key audit event.')
    }
}

function responseKey(key: ProfileSshKey, lastUsedAt: string | null = null) {
    const normalized = normalizeHostPublicKey(key.public_key)
    return {
        id: key.id,
        name: key.name,
        fingerprint: normalized?.fingerprint || '',
        keyType: normalized?.publicKey.split(' ', 1)[0] || 'SSH key',
        addedAt: key.added_at,
        lastUsedAt,
    }
}

export async function getProfileSshKeys(req: FastifyRequest, res: FastifyReply) {
    const userId = await authorizeSelf(req, res)
    if (!userId) return
    try {
        const keys = (await profileKeys(userId)).flatMap(key => {
            const normalized = normalizeHostPublicKey(key.public_key)
            return normalized ? [{ key, normalized }] : []
        })
        const fingerprints = keys.map(({ normalized }) => normalized.fingerprint)
        let usage = new Map<string, string>()
        try {
            usage = await profileKeyUsage(fingerprints)
        } catch (error) {
            req.log.error({ err: error }, 'Unable to load profile SSH key usage.')
        }
        return res.send({ keys: keys.map(({ key, normalized }) => responseKey(key, usage.get(normalized.fingerprint) || null)) })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to list profile SSH keys.')
        return res.status(500).send({ error: 'Unable to load SSH keys.' })
    }
}

export async function postProfileSshKey(req: FastifyRequest, res: FastifyReply) {
    const userId = await authorizeSelf(req, res)
    if (!userId) return
    const body = (req.body || {}) as { name?: unknown, publicKey?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const key = normalizeHostPublicKey(body.publicKey)
    if (!name || name.length > 100 || !key) {
        return res.status(400).send({ error: 'Enter a name and one valid OpenSSH public key.' })
    }

    try {
        return await withDatabaseAdvisoryLock('profile-ssh-keys-sync', async () => {
            const existing = await profileKeys(userId)
            if (existing.some(item => normalizeHostPublicKey(item.public_key)?.fingerprint === key.fingerprint)) {
                return res.status(409).send({ error: 'That SSH key is already on your profile.' })
            }
            const before = await currentHostKeys()
            const created = await withTransaction(async execute => {
                const inserted = await execute(`
                    INSERT INTO certificates (name, public_key, owner, created_by)
                    VALUES ($1, $2, $3, $3)
                    RETURNING id
                `, [name, key.publicKey, userId])
                const id = Number(inserted.rows[0]?.id)
                if (!Number.isInteger(id)) throw new Error('Unable to save SSH key.')
                const assigned = await execute(`
                    INSERT INTO user_certificates (user_id, certificate_id)
                    VALUES ($1, $2)
                    RETURNING assigned_at
                `, [userId, id])
                return { id, addedAt: assigned.rows[0]?.assigned_at }
            })
            try {
                await applyManagedHostSshKeys(await currentHostKeys())
            } catch (error) {
                await withTransaction(async execute => {
                    await execute('DELETE FROM user_certificates WHERE user_id = $1 AND certificate_id = $2', [userId, created.id])
                    await execute('DELETE FROM certificates WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM user_certificates WHERE certificate_id = $1)', [created.id])
                }).catch(rollbackError => req.log.error({ err: rollbackError, certificateId: created.id }, 'Unable to roll back a profile SSH key update.'))
                await applyManagedHostSshKeys(before).catch(rollbackError => req.log.error({ err: rollbackError }, 'Unable to restore host SSH keys after a failed profile update.'))
                req.log.error({ err: error, certificateId: created.id }, 'Unable to apply a profile SSH key to all hosts.')
                return res.status(503).send({ error: 'Unable to apply this key on both hosts. No change was saved.' })
            }
            await writeAudit(req, userId, 'user.ssh_key.added', created.id, key.fingerprint)
            return res.status(201).send({
                key: responseKey({ id: created.id, name, public_key: key.publicKey, added_at: String(created.addedAt) }),
            })
        })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to save a profile SSH key.')
        return res.status(500).send({ error: 'Unable to save this SSH key.' })
    }
}

export async function deleteProfileSshKey(req: FastifyRequest, res: FastifyReply) {
    const userId = await authorizeSelf(req, res)
    if (!userId) return
    const rawId = (req.params as { id?: string }).id || ''
    if (!/^\d{1,10}$/.test(rawId)) return res.status(400).send({ error: 'Invalid SSH key.' })
    const certificateId = Number(rawId)
    try {
        return await withDatabaseAdvisoryLock('profile-ssh-keys-sync', async () => {
            const existing = (await profileKeys(userId)).find(item => item.id === certificateId)
            const normalized = normalizeHostPublicKey(existing?.public_key)
            if (!existing || !normalized) return res.status(404).send({ error: 'SSH key not found.' })
            const fingerprint = normalized.fingerprint
            const before = await currentHostKeys()
            const after = await currentHostKeys({ userId, certificateId })
            const afterFingerprints = new Set(after.map(value => normalizeHostPublicKey(value)?.fingerprint).filter(Boolean))
            const revoked = before.filter(value => {
                const fingerprint = normalizeHostPublicKey(value)?.fingerprint
                return fingerprint && !afterFingerprints.has(fingerprint)
            })
            try {
                await applyManagedHostSshKeys(after, revoked)
            } catch (error) {
                await applyManagedHostSshKeys(before).catch(rollbackError => req.log.error({ err: rollbackError }, 'Unable to restore host SSH keys after a failed profile key removal.'))
                req.log.error({ err: error, certificateId }, 'Unable to remove a profile SSH key from all hosts.')
                return res.status(503).send({ error: 'Unable to remove this key from both hosts. No change was saved.' })
            }
            try {
                await withTransaction(async execute => {
                    await execute('DELETE FROM user_certificates WHERE user_id = $1 AND certificate_id = $2', [userId, certificateId])
                    await execute('DELETE FROM certificates WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM user_certificates WHERE certificate_id = $1)', [certificateId])
                })
            } catch (error) {
                await applyManagedHostSshKeys(before).catch(rollbackError => req.log.error({ err: rollbackError }, 'Unable to restore host SSH keys after a profile database failure.'))
                throw error
            }
            await writeAudit(req, userId, 'user.ssh_key.removed', certificateId, fingerprint)
            return res.send({ ok: true })
        })
    } catch (error) {
        req.log.error({ err: error, certificateId }, 'Unable to remove a profile SSH key.')
        return res.status(500).send({ error: 'Unable to remove this SSH key.' })
    }
}
