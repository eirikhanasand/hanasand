import { reservedUsernames } from '@/utils/auth/reservedUsernames'

const reserved = new Set(reservedUsernames)

export function isReservedPlaceholder(user: { id: string, username?: string, active?: boolean }) {
    return user.active === false && (reserved.has(user.id.toLowerCase()) || reserved.has((user.username || '').toLowerCase()))
}
