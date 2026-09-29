const storageKey = 'hanasand-password-reset-session'

type PasswordResetSession = {
    userId: string
    resetToken: string
}

export function storePasswordResetSession(userId: string, resetToken: string) {
    try {
        sessionStorage.setItem(storageKey, JSON.stringify({ userId, resetToken } satisfies PasswordResetSession))
        return true
    } catch {
        return false
    }
}

export function readPasswordResetSession(userId: string) {
    try {
        const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as PasswordResetSession | null
        return value?.userId === userId && typeof value.resetToken === 'string' ? value.resetToken : ''
    } catch {
        return ''
    }
}

export function clearPasswordResetSession(userId: string) {
    try {
        const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as PasswordResetSession | null
        if (value?.userId === userId) sessionStorage.removeItem(storageKey)
    } catch {
        // Storage may be disabled; completing a password reset must still succeed.
    }
}
