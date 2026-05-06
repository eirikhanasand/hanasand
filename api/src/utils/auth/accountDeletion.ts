import { createHash, randomBytes } from 'crypto'

export function createAccountRestoreToken() {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: hashAccountRestoreToken(token) }
}

export function hashAccountRestoreToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}
