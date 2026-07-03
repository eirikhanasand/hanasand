import { createHash, createPublicKey, createVerify, randomBytes } from 'crypto'

export type PasskeyConfig = {
    rpId: string
    rpName: string
    origin: string
}

export type ParsedRegistration = {
    credentialId: string
    publicKeyCose: string
    signCount: number
    alg: number
    aaguid: string
}

export type ParsedAssertion = {
    signCount: number
    userPresent: boolean
}

type ClientData = {
    type?: string
    challenge?: string
    origin?: string
}

type AuthData = {
    flags: number
    signCount: number
    credentialId?: Buffer
    publicKeyCose?: Buffer
    aaguid?: Buffer
}

export function passkeyConfig(): PasskeyConfig {
    const origin = clean(process.env.PASSKEY_ORIGIN)
        || clean(process.env.WEBAUTHN_ORIGIN)
        || clean(process.env.NEXT_PUBLIC_APP_URL)
        || 'https://hanasand.com'
    const rpId = clean(process.env.PASSKEY_RP_ID)
        || clean(process.env.WEBAUTHN_RP_ID)
        || hostnameFromOrigin(origin)
        || 'hanasand.com'
    return {
        origin,
        rpId,
        rpName: clean(process.env.PASSKEY_RP_NAME) || 'Hanasand',
    }
}

export function newPasskeyChallenge() {
    return randomBytes(32).toString('base64url')
}

export function userHandleFor(userId: string) {
    return Buffer.from(userId, 'utf8').toString('base64url')
}

export function decodeUserHandle(value: string | null | undefined) {
    if (!value) return null
    try {
        return Buffer.from(value, 'base64url').toString('utf8')
    } catch {
        return null
    }
}

export function verifyRegistrationCredential(input: {
    credential: Record<string, any>
    challenge: string
    config: PasskeyConfig
}): ParsedRegistration {
    const response = toRecord(input.credential.response)
    const clientDataJSON = fromBase64Url(text(response.clientDataJSON))
    const clientData = parseClientData(clientDataJSON)
    assertClientData(clientData, 'webauthn.create', input.challenge, input.config.origin)

    const attestationObject = readCbor(fromBase64Url(text(response.attestationObject))) as Map<unknown, unknown>
    const authDataBytes = mapGetBuffer(attestationObject, 'authData')
    const authData = parseAuthData(authDataBytes)
    if (!authData.credentialId || !authData.publicKeyCose || !authData.aaguid) {
        throw new Error('Passkey registration did not include attested credential data.')
    }
    assertRpIdHash(authDataBytes, input.config.rpId)
    assertUserPresent(authData.flags)

    const publicKey = readCbor(authData.publicKeyCose) as Map<unknown, unknown>
    const alg = mapGetNumber(publicKey, 3)
    if (![-7, -257].includes(alg)) {
        throw new Error(`Unsupported passkey public key algorithm ${alg}.`)
    }

    return {
        credentialId: authData.credentialId.toString('base64url'),
        publicKeyCose: authData.publicKeyCose.toString('base64url'),
        signCount: authData.signCount,
        alg,
        aaguid: authData.aaguid.toString('hex'),
    }
}

export function verifyAssertionCredential(input: {
    credential: Record<string, any>
    challenge: string
    config: PasskeyConfig
    publicKeyCose: string
    previousSignCount: number
}): ParsedAssertion {
    const response = toRecord(input.credential.response)
    const authenticatorData = fromBase64Url(text(response.authenticatorData))
    const clientDataJSON = fromBase64Url(text(response.clientDataJSON))
    const signature = fromBase64Url(text(response.signature))
    const clientData = parseClientData(clientDataJSON)
    assertClientData(clientData, 'webauthn.get', input.challenge, input.config.origin)
    assertRpIdHash(authenticatorData, input.config.rpId)

    const authData = parseAuthData(authenticatorData)
    assertUserPresent(authData.flags)
    const signed = Buffer.concat([
        authenticatorData,
        createHash('sha256').update(clientDataJSON).digest(),
    ])
    const publicKey = publicKeyFromCose(fromBase64Url(input.publicKeyCose))
    const verifier = createVerify('SHA256')
    verifier.update(signed)
    verifier.end()
    if (!verifier.verify(publicKey, signature)) {
        throw new Error('Passkey signature was invalid.')
    }
    if (authData.signCount > 0 && input.previousSignCount > 0 && authData.signCount <= input.previousSignCount) {
        throw new Error('Passkey sign counter did not advance.')
    }

    return {
        signCount: authData.signCount,
        userPresent: true,
    }
}

export function publicKeyCredentialDescriptor(id: string) {
    return {
        type: 'public-key',
        id,
        transports: ['internal', 'hybrid', 'usb', 'nfc', 'ble'],
    }
}

function publicKeyFromCose(publicKeyCose: Buffer) {
    const cose = readCbor(publicKeyCose) as Map<unknown, unknown>
    const alg = mapGetNumber(cose, 3)
    if (alg === -7) {
        const x = mapGetBuffer(cose, -2).toString('base64url')
        const y = mapGetBuffer(cose, -3).toString('base64url')
        return createPublicKey({
            key: { kty: 'EC', crv: 'P-256', x, y },
            format: 'jwk',
        })
    }
    if (alg === -257) {
        const n = mapGetBuffer(cose, -1).toString('base64url')
        const e = mapGetBuffer(cose, -2).toString('base64url')
        return createPublicKey({
            key: { kty: 'RSA', n, e },
            format: 'jwk',
        })
    }
    throw new Error(`Unsupported passkey public key algorithm ${alg}.`)
}

function parseAuthData(bytes: Buffer): AuthData {
    if (bytes.length < 37) {
        throw new Error('Passkey authenticator data was too short.')
    }
    const flags = bytes[32]
    const signCount = bytes.readUInt32BE(33)
    const result: AuthData = { flags, signCount }
    if ((flags & 0x40) === 0) {
        return result
    }
    let offset = 37
    result.aaguid = bytes.subarray(offset, offset + 16)
    offset += 16
    const credentialIdLength = bytes.readUInt16BE(offset)
    offset += 2
    result.credentialId = bytes.subarray(offset, offset + credentialIdLength)
    offset += credentialIdLength
    result.publicKeyCose = bytes.subarray(offset)
    return result
}

function assertRpIdHash(authenticatorData: Buffer, rpId: string) {
    const expected = createHash('sha256').update(rpId).digest()
    if (!authenticatorData.subarray(0, 32).equals(expected)) {
        throw new Error('Passkey RP ID hash did not match.')
    }
}

function assertUserPresent(flags: number) {
    if ((flags & 0x01) === 0) {
        throw new Error('Passkey user-present flag was not set.')
    }
}

function parseClientData(clientDataJSON: Buffer): ClientData {
    return JSON.parse(clientDataJSON.toString('utf8')) as ClientData
}

function assertClientData(clientData: ClientData, type: string, challenge: string, origin: string) {
    if (clientData.type !== type) {
        throw new Error('Passkey client data type did not match.')
    }
    if (clientData.challenge !== challenge) {
        throw new Error('Passkey challenge did not match.')
    }
    if (clientData.origin !== origin) {
        throw new Error('Passkey origin did not match.')
    }
}

function readCbor(data: Buffer) {
    return new CborReader(data).read()
}

class CborReader {
    private offset = 0

    constructor(private readonly data: Buffer) {}

    read(): unknown {
        const first = this.readByte()
        const major = first >> 5
        const additional = first & 0x1f
        const length = this.readLength(additional)
        if (major === 0) return length
        if (major === 1) return -1 - length
        if (major === 2) return this.readBytes(length)
        if (major === 3) return this.readBytes(length).toString('utf8')
        if (major === 4) return Array.from({ length }, () => this.read())
        if (major === 5) {
            const map = new Map<unknown, unknown>()
            for (let index = 0; index < length; index++) {
                map.set(this.read(), this.read())
            }
            return map
        }
        if (major === 6) return this.read()
        if (major === 7) {
            if (additional === 20) return false
            if (additional === 21) return true
            if (additional === 22) return null
        }
        throw new Error('Unsupported CBOR value in passkey payload.')
    }

    private readByte() {
        if (this.offset >= this.data.length) {
            throw new Error('Unexpected end of CBOR payload.')
        }
        return this.data[this.offset++]
    }

    private readLength(additional: number) {
        if (additional < 24) return additional
        if (additional === 24) return this.readByte()
        if (additional === 25) {
            const value = this.data.readUInt16BE(this.offset)
            this.offset += 2
            return value
        }
        if (additional === 26) {
            const value = this.data.readUInt32BE(this.offset)
            this.offset += 4
            return value
        }
        throw new Error('Unsupported CBOR length in passkey payload.')
    }

    private readBytes(length: number) {
        const value = this.data.subarray(this.offset, this.offset + length)
        this.offset += length
        if (value.length !== length) {
            throw new Error('Unexpected end of CBOR byte string.')
        }
        return value
    }
}

function mapGetBuffer(map: Map<unknown, unknown>, key: unknown) {
    const value = map.get(key)
    if (!Buffer.isBuffer(value)) {
        throw new Error(`Passkey CBOR field ${String(key)} was missing.`)
    }
    return value
}

function mapGetNumber(map: Map<unknown, unknown>, key: unknown) {
    const value = map.get(key)
    if (typeof value !== 'number') {
        throw new Error(`Passkey CBOR numeric field ${String(key)} was missing.`)
    }
    return value
}

function fromBase64Url(value: string) {
    if (!value) throw new Error('Passkey payload field was empty.')
    return Buffer.from(value, 'base64url')
}

function hostnameFromOrigin(origin: string) {
    try {
        return new URL(origin).hostname
    } catch {
        return ''
    }
}

function clean(value: unknown) {
    return String(value ?? '').trim()
}

function text(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown) {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
