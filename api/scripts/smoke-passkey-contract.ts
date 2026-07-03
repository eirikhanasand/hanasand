import assert from 'node:assert/strict'
import { createHash, createSign, generateKeyPairSync } from 'node:crypto'
import { mock } from 'bun:test'
import {
    newPasskeyChallenge,
    passkeyConfig,
    verifyAssertionCredential,
    verifyRegistrationCredential,
} from '../src/utils/auth/passkeys.ts'

process.env.PASSKEY_ORIGIN = 'https://hanasand.com'
process.env.PASSKEY_RP_ID = 'hanasand.com'

const config = passkeyConfig()
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey
const credentialId = Buffer.from('passkey-contract-credential')
const publicKeyCose = cborMap(new Map<unknown, unknown>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, Buffer.from(String(jwk.x), 'base64url')],
    [-3, Buffer.from(String(jwk.y), 'base64url')],
]))
const createChallenge = newPasskeyChallenge()
const registrationClientData = clientData('webauthn.create', createChallenge, config.origin)
const registrationAuthData = authenticatorData({
    rpId: config.rpId,
    flags: 0x41,
    signCount: 1,
    credentialId,
    publicKeyCose,
})
const attestationObject = cborMap(new Map<unknown, unknown>([
    ['fmt', 'none'],
    ['authData', registrationAuthData],
    ['attStmt', cborMap(new Map())],
]))
const parsedRegistration = verifyRegistrationCredential({
    config,
    challenge: createChallenge,
    credential: {
        id: credentialId.toString('base64url'),
        rawId: credentialId.toString('base64url'),
        response: {
            clientDataJSON: registrationClientData.toString('base64url'),
            attestationObject: attestationObject.toString('base64url'),
        },
    },
})
assert.equal(parsedRegistration.credentialId, credentialId.toString('base64url'))
assert.equal(parsedRegistration.alg, -7)
assert.equal(parsedRegistration.signCount, 1)

const getChallenge = newPasskeyChallenge()
const assertionClientData = clientData('webauthn.get', getChallenge, config.origin)
const assertionAuthData = authenticatorData({
    rpId: config.rpId,
    flags: 0x01,
    signCount: 2,
})
const signed = Buffer.concat([
    assertionAuthData,
    createHash('sha256').update(assertionClientData).digest(),
])
const signer = createSign('SHA256')
signer.update(signed)
signer.end()
const assertion = verifyAssertionCredential({
    config,
    challenge: getChallenge,
    previousSignCount: 1,
    publicKeyCose: parsedRegistration.publicKeyCose,
    credential: {
        id: credentialId.toString('base64url'),
        rawId: credentialId.toString('base64url'),
        response: {
            clientDataJSON: assertionClientData.toString('base64url'),
            authenticatorData: assertionAuthData.toString('base64url'),
            signature: signer.sign(privateKey).toString('base64url'),
        },
    },
})
assert.equal(assertion.signCount, 2)
assert.equal(assertion.userPresent, true)

await smokePasskeyManagementHandlers()

console.log('Passkey contract smoke passed')

async function smokePasskeyManagementHandlers() {
    const rows = [
        {
            credential_id: 'cred-es256',
            label: 'Passkey (platform)',
            alg: -7,
            aaguid: '00000000-0000-0000-0000-000000000000',
            sign_count: 4,
            created_at: '2026-07-01T10:00:00.000Z',
            last_used_at: '2026-07-02T10:00:00.000Z',
            user_id: 'passkey-user',
        },
        {
            credential_id: 'cred-rs256',
            label: 'Security key',
            alg: -257,
            aaguid: null,
            sign_count: 1,
            created_at: '2026-07-01T09:00:00.000Z',
            last_used_at: null,
            user_id: 'passkey-user',
        },
    ]

    mock.module('#db', () => ({
        default: async (query: string, params: unknown[] = []) => {
            const compact = query.replace(/\s+/g, ' ').trim()
            if (compact.startsWith('SELECT credential_id, label, alg')) {
                assert.equal(params[0], 'passkey-user')
                return { rows: rows.filter(row => row.user_id === params[0]) }
            }
            if (compact.startsWith('DELETE FROM user_passkeys')) {
                const [credentialId, userId] = params
                const index = rows.findIndex(row => row.credential_id === credentialId && row.user_id === userId)
                if (index === -1) return { rows: [] }
                const [deleted] = rows.splice(index, 1)
                return { rows: [{ credential_id: deleted.credential_id }] }
            }
            throw new Error(`Unexpected passkey smoke query: ${compact}`)
        },
    }))
    mock.module('#utils/auth/tokenWrapper.ts', () => ({
        default: async () => ({ valid: true, id: 'passkey-user' }),
    }))

    const { getPasskeys, deletePasskey } = await import('../src/handlers/auth/passkeys.ts')

    const listReply = makeReply()
    await getPasskeys({} as any, listReply as any)
    assert.equal(listReply.statusCode, 200)
    assert.deepEqual(listReply.payload.passkeys.map((item: any) => ({
        credentialId: item.credentialId,
        algorithm: item.algorithm,
        signCount: item.signCount,
        lastUsedAt: item.lastUsedAt,
    })), [
        {
            credentialId: 'cred-es256',
            algorithm: 'ES256',
            signCount: 4,
            lastUsedAt: '2026-07-02T10:00:00.000Z',
        },
        {
            credentialId: 'cred-rs256',
            algorithm: 'RS256',
            signCount: 1,
            lastUsedAt: null,
        },
    ])

    const deleteReply = makeReply()
    await deletePasskey({ params: { credentialId: 'cred-es256' } } as any, deleteReply as any)
    assert.equal(deleteReply.statusCode, 200)
    assert.deepEqual(deleteReply.payload, { ok: true, credentialId: 'cred-es256' })

    const listAfterDeleteReply = makeReply()
    await getPasskeys({} as any, listAfterDeleteReply as any)
    assert.deepEqual(listAfterDeleteReply.payload.passkeys.map((item: any) => item.credentialId), ['cred-rs256'])

    const repeatDeleteReply = makeReply()
    await deletePasskey({ params: { credentialId: 'cred-es256' } } as any, repeatDeleteReply as any)
    assert.equal(repeatDeleteReply.statusCode, 404)
    assert.equal(repeatDeleteReply.payload.error, 'Passkey not found.')
}

function makeReply() {
    return {
        statusCode: 200,
        payload: undefined as any,
        status(code: number) {
            this.statusCode = code
            return this
        },
        send(payload: unknown) {
            this.payload = payload
            return payload
        },
    }
}

function clientData(type: string, challenge: string, origin: string) {
    return Buffer.from(JSON.stringify({ type, challenge, origin }), 'utf8')
}

function authenticatorData(input: {
    rpId: string
    flags: number
    signCount: number
    credentialId?: Buffer
    publicKeyCose?: Buffer
}) {
    const base = Buffer.alloc(37)
    createHash('sha256').update(input.rpId).digest().copy(base, 0)
    base[32] = input.flags
    base.writeUInt32BE(input.signCount, 33)
    if (!input.credentialId || !input.publicKeyCose) {
        return base
    }

    const aaguid = Buffer.alloc(16)
    const credentialLength = Buffer.alloc(2)
    credentialLength.writeUInt16BE(input.credentialId.length, 0)
    return Buffer.concat([base, aaguid, credentialLength, input.credentialId, input.publicKeyCose])
}

function cborMap(map: Map<unknown, unknown>) {
    const entries: Buffer[] = [cborHead(5, map.size)]
    for (const [key, value] of map.entries()) {
        entries.push(cborValue(key), cborValue(value))
    }
    return Buffer.concat(entries)
}

function cborValue(value: unknown): Buffer {
    if (typeof value === 'number') {
        return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
    }
    if (typeof value === 'string') {
        const bytes = Buffer.from(value, 'utf8')
        return Buffer.concat([cborHead(3, bytes.length), bytes])
    }
    if (Buffer.isBuffer(value)) {
        return Buffer.concat([cborHead(2, value.length), value])
    }
    if (value instanceof Map) {
        return cborMap(value)
    }
    throw new Error('Unsupported test CBOR value.')
}

function cborHead(major: number, value: number) {
    if (value < 24) return Buffer.from([(major << 5) | value])
    if (value < 256) return Buffer.from([(major << 5) | 24, value])
    if (value < 65536) {
        const bytes = Buffer.alloc(3)
        bytes[0] = (major << 5) | 25
        bytes.writeUInt16BE(value, 1)
        return bytes
    }
    const bytes = Buffer.alloc(5)
    bytes[0] = (major << 5) | 26
    bytes.writeUInt32BE(value, 1)
    return bytes
}
