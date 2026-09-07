import { getReservedUsernameReason } from './reservedUsernames.ts'

export function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const email = value.trim().toLowerCase()
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
export function usernameError(value: string) {
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(value)) return 'Use 3–40 letters, numbers, dots, underscores or hyphens for your username.'
    return getReservedUsernameReason(value)
}
export class AccountIdentityError extends Error {}
