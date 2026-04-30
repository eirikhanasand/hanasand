import checkPwned from '#utils/pwned/checkPwned.ts'

export async function validatePassword(password: string) {
    const strength = getPasswordStrength(password)
    if (!strength.valid) {
        return { valid: false, error: 'The password does not meet the requirements.' }
    }

    const pwned = await checkPwned(password)
    if ('count' in pwned) {
        return {
            valid: false,
            error: `This password is weak, and has been pwned ${pwned.count} ${pwned.count === 1 ? 'time' : 'times'}.`
        }
    }

    return { valid: true, error: null }
}

export function getPasswordStrength(password: string) {
    let numbers = 0
    let specialCharacters = 0
    let lowerCaseCharacters = 0
    let upperCaseCharacters = 0

    for (const char of password) {
        if (!isNaN(Number(char))) {
            numbers++
        }

        if (/[^a-zA-Z0-9]/.test(char)) {
            specialCharacters++
        }

        if (/[a-z]/.test(char)) {
            lowerCaseCharacters++
        }

        if (/[A-Z]/.test(char)) {
            upperCaseCharacters++
        }
    }

    return {
        numbers,
        specialCharacters,
        lowerCaseCharacters,
        upperCaseCharacters,
        valid: password.length >= 16
            && numbers >= 2
            && specialCharacters >= 2
            && lowerCaseCharacters >= 2
            && upperCaseCharacters >= 2,
    }
}
