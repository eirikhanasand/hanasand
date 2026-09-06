import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const codeAccessCookie = 'hanasand_code_session'
export const codeAccessLifetime = 86400
const defaultCodeHash = '083e79339fd06022b69a407d589ccb11a2ef16b3a2c19bba58df00c2bac1fb08'
const codeHash = () => process.env.CODE_PAGE_PASSWORD_HASH || defaultCodeHash
function sign(value: string) {
    const secret = process.env.CODE_PAGE_SESSION_SECRET || process.env.VM_API_TOKEN
    if (!secret) throw new Error('Code access is not configured.')
    return createHmac('sha256', secret).update('thesis-code-read:' + codeHash() + ':' + value).digest('hex')
}
export function matchesCode(code: unknown) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false
    const expected = codeHash()
    if (!/^[a-f0-9]{64}$/.test(expected)) return false
    return timingSafeEqual(Buffer.from(createHash('sha256').update(code).digest('hex')), Buffer.from(expected))
}
export function createCodeSession(now = Date.now()) {
    const value = `${Math.floor(now / 1000) + codeAccessLifetime}.${randomBytes(16).toString('hex')}`
    return `${value}.${sign(value)}`
}
export function validCodeSession(cookie?: string, now = Date.now()) {
    if (!cookie || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(cookie)) return false
    const [expires, nonce, signature] = cookie.split('.')
    const remaining = Number(expires) - Math.floor(now / 1000)
    if (remaining <= 0 || remaining > codeAccessLifetime) return false
    try { return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${expires}.${nonce}`))) }
    catch { return false }
}

// Bound guesses even if a caller spoofs forwarding headers; per-address limits also
// stop one client consuming the whole allowance. Entries expire with the window.
let windowEnd = 0, attempts = 0
const clients = new Map<string, number>()
export function codeLoginRetryAfter(address: string, now = Date.now()) {
    if (now >= windowEnd) { windowEnd = now + 15 * 60_000; attempts = 0; clients.clear() }
    const count = clients.get(address) || 0
    if (attempts >= 50 || count >= 5) return Math.ceil((windowEnd - now) / 1000)
    attempts++
    clients.set(address, count + 1)
    return 0
}
