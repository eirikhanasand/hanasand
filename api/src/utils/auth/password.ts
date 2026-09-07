import checkPwned from '#utils/pwned/checkPwned.ts'

export async function validatePassword(password: string) {
    const strength = getPasswordStrength(password)
    if (!strength.valid) {
        return { valid: false, error: 'Use at least 16 characters, including one uppercase letter, one lowercase letter, one number, and one special character.' }
    }

    const pwned = await checkPwned(password)
    if (!pwned.ok) {
        return {
            valid: false,
            error: `This password is weak, and has been pwned ${pwned.count} ${pwned.count === 1 ? 'time' : 'times'}.`
        }
    }

    return { valid: true, error: null }
}

export function getPasswordStrength(password: string) {
    return { valid: typeof password === 'string' && password.length >= 16
        && /[A-Z]/.test(password) && /[a-z]/.test(password)
        && /[0-9]/.test(password) && /[^a-zA-Z0-9\s]/.test(password) }
}
