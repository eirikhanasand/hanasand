import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { issueToken } from '#utils/auth/session.ts'
import {
    decodeUserHandle,
    newPasskeyChallenge,
    passkeyConfig,
    publicKeyCredentialDescriptor,
    userHandleFor,
    verifyAssertionCredential,
    verifyRegistrationCredential,
} from '#utils/auth/passkeys.ts'

type PasskeyBody = {
    challengeId?: string
    credential?: Record<string, any>
}

type ChallengeRow = {
    id: string
    user_id: string | null
    challenge: string
    purpose: 'register' | 'authenticate'
}

type CredentialRow = {
    credential_id: string
    user_id: string
    public_key_cose: string
    sign_count: number
}

export async function getPasskeyRegisterOptions(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const user = await userForPasskey(actor.id)
    if (!user) {
        return res.status(404).send({ error: 'User not found.' })
    }

    const config = passkeyConfig()
    const challenge = await createPasskeyChallenge(actor.id, 'register')
    const existing = await run(
        'SELECT credential_id FROM user_passkeys WHERE user_id = $1 ORDER BY created_at DESC',
        [actor.id],
    )

    return res.send({
        challengeId: challenge.id,
        publicKey: {
            challenge: challenge.challenge,
            rp: { name: config.rpName, id: config.rpId },
            user: {
                id: userHandleFor(user.id),
                name: user.id,
                displayName: user.name || user.id,
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
            excludeCredentials: existing.rows.map(row => publicKeyCredentialDescriptor(String(row.credential_id))),
        },
    })
}

export async function getPasskeys(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const result = await run(`
        SELECT credential_id, label, alg, aaguid, sign_count, created_at, last_used_at
        FROM user_passkeys
        WHERE user_id = $1
        ORDER BY last_used_at DESC NULLS LAST, created_at DESC
    `, [actor.id])

    return res.send({
        passkeys: result.rows.map(row => ({
            credentialId: row.credential_id,
            label: row.label,
            algorithm: Number(row.alg) === -7 ? 'ES256' : Number(row.alg) === -257 ? 'RS256' : String(row.alg),
            aaguid: row.aaguid,
            signCount: Number(row.sign_count || 0),
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
        })),
    })
}

export async function deletePasskey(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const { credentialId } = req.params as { credentialId?: string } ?? {}
    if (!credentialId) {
        return res.status(400).send({ error: 'Missing passkey credential id.' })
    }

    const result = await run(
        'DELETE FROM user_passkeys WHERE credential_id = $1 AND user_id = $2 RETURNING credential_id',
        [credentialId, actor.id],
    )
    if (!result.rows.length) {
        return res.status(404).send({ error: 'Passkey not found.' })
    }

    return res.send({ ok: true, credentialId })
}

export async function postPasskeyRegisterVerify(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const body = req.body as PasskeyBody ?? {}
    const challenge = await consumePasskeyChallenge(body.challengeId, 'register', actor.id)
    if (!challenge || !body.credential) {
        return res.status(400).send({ error: 'Passkey registration challenge is invalid or expired.' })
    }

    try {
        const parsed = verifyRegistrationCredential({
            credential: body.credential,
            challenge: challenge.challenge,
            config: passkeyConfig(),
        })
        await run(`
            INSERT INTO user_passkeys (
                credential_id,
                user_id,
                public_key_cose,
                sign_count,
                alg,
                aaguid,
                label,
                last_used_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
            ON CONFLICT (credential_id)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                public_key_cose = EXCLUDED.public_key_cose,
                sign_count = EXCLUDED.sign_count,
                alg = EXCLUDED.alg,
                aaguid = EXCLUDED.aaguid,
                label = EXCLUDED.label
        `, [
            parsed.credentialId,
            actor.id,
            parsed.publicKeyCose,
            parsed.signCount,
            parsed.alg,
            parsed.aaguid,
            labelForCredential(body.credential),
        ])

        return res.send({
            ok: true,
            credentialId: parsed.credentialId,
            userId: actor.id,
            signCount: parsed.signCount,
        })
    } catch (error) {
        req.log.warn({ error, userId: actor.id }, 'Passkey registration verification failed')
        return res.status(400).send({ error: 'Passkey registration could not be verified.' })
    }
}

export async function getPasskeyAuthenticateOptions(req: FastifyRequest, res: FastifyReply) {
    const query = req.query as { username?: string } | undefined
    const username = String(query?.username || '').trim().toLowerCase()
    const user = username ? await userForPasskey(username) : null
    const credentials = username
        ? await run('SELECT credential_id FROM user_passkeys WHERE user_id = $1 ORDER BY last_used_at DESC NULLS LAST, created_at DESC', [username])
        : { rows: [] as Array<{ credential_id: string }> }
    if (username && !user) {
        return res.status(404).send({ error: 'No passkeys are registered for that account.' })
    }

    const config = passkeyConfig()
    const challenge = await createPasskeyChallenge(user?.id || null, 'authenticate')
    return res.send({
        challengeId: challenge.id,
        publicKey: {
            challenge: challenge.challenge,
            rpId: config.rpId,
            timeout: 60000,
            userVerification: 'preferred',
            allowCredentials: credentials.rows.map(row => publicKeyCredentialDescriptor(String(row.credential_id))),
        },
    })
}

export async function postPasskeyAuthenticateVerify(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as PasskeyBody ?? {}
    const challenge = await consumePasskeyChallenge(body.challengeId, 'authenticate')
    if (!challenge || !body.credential) {
        return res.status(400).send({ error: 'Passkey login challenge is invalid or expired.' })
    }

    const credentialId = credentialIdFromBody(body.credential)
    const credential = credentialId ? await credentialForId(credentialId) : null
    if (!credential || (challenge.user_id && challenge.user_id !== credential.user_id)) {
        return res.status(404).send({ error: 'Passkey credential was not recognized.' })
    }

    const userHandle = decodeUserHandle(String(body.credential.response?.userHandle || ''))
    if (userHandle && userHandle !== credential.user_id) {
        return res.status(403).send({ error: 'Passkey user handle did not match the credential owner.' })
    }

    try {
        const assertion = verifyAssertionCredential({
            credential: body.credential,
            challenge: challenge.challenge,
            config: passkeyConfig(),
            publicKeyCose: credential.public_key_cose,
            previousSignCount: credential.sign_count,
        })
        await run(`
            UPDATE user_passkeys
            SET sign_count = GREATEST(sign_count, $2),
                last_used_at = NOW()
            WHERE credential_id = $1
        `, [credential.credential_id, assertion.signCount])

        const user = await userForPasskey(credential.user_id)
        if (!user?.active || user.deletion_scheduled_at) {
            return res.status(403).send({ error: 'This account is not active.' })
        }
        const roles = await rolesForUser(user.id)
        const session = await issueToken({
            id: user.id,
            ip: req.ip,
            userAgent: String(req.headers['user-agent'] || ''),
        })
        if (!session) {
            return res.status(503).send({ error: 'Passkey login succeeded, but the session could not be created.' })
        }

        return res.send({
            id: user.id,
            name: user.name,
            avatar: user.avatar ?? '',
            roles,
            token: session.token,
            expires_at: session.expires_at,
            authProvider: 'passkey',
        })
    } catch (error) {
        req.log.warn({ error, credentialId }, 'Passkey assertion verification failed')
        return res.status(400).send({ error: 'Passkey login could not be verified.' })
    }
}

async function createPasskeyChallenge(userId: string | null, purpose: ChallengeRow['purpose']) {
    const challenge = newPasskeyChallenge()
    const result = await run(`
        INSERT INTO passkey_challenges (user_id, purpose, challenge, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
        RETURNING id, user_id, purpose, challenge
    `, [userId, purpose, challenge])
    return result.rows[0] as ChallengeRow
}

async function consumePasskeyChallenge(id: string | undefined, purpose: ChallengeRow['purpose'], userId?: string) {
    if (!id) return null
    const result = await run(`
        UPDATE passkey_challenges
        SET consumed_at = NOW()
        WHERE id = $1
          AND purpose = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
          AND ($3::text IS NULL OR user_id = $3)
        RETURNING id, user_id, purpose, challenge
    `, [id, purpose, userId || null])
    return (result.rows[0] as ChallengeRow | undefined) || null
}

async function userForPasskey(userId: string) {
    const result = await run(`
        SELECT id, name, avatar, active, deletion_scheduled_at
        FROM users
        WHERE lower(id) = lower($1)
        LIMIT 1
    `, [userId])
    return result.rows[0] as { id: string, name: string, avatar: string | null, active: boolean, deletion_scheduled_at?: string | null } | undefined
}

async function credentialForId(credentialId: string) {
    const result = await run(`
        SELECT credential_id, user_id, public_key_cose, sign_count
        FROM user_passkeys
        WHERE credential_id = $1
        LIMIT 1
    `, [credentialId])
    return (result.rows[0] as CredentialRow | undefined) || null
}

async function rolesForUser(userId: string) {
    const roleResponse = await run(`
        SELECT r.id, r.name, r.description, r.priority
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.priority ASC, r.id ASC
    `, [userId])
    return roleResponse.rows
}

function credentialIdFromBody(credential: Record<string, any>) {
    return String(credential.rawId || credential.id || '').trim()
}

function labelForCredential(credential: Record<string, any>) {
    const authenticatorAttachment = String(credential.authenticatorAttachment || '').trim()
    return authenticatorAttachment ? `Passkey (${authenticatorAttachment})` : 'Passkey'
}
