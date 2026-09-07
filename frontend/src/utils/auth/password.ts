export const passwordRequirementMessage = 'Use at least 16 characters, including one uppercase letter, one lowercase letter, one number, and one special character.'

export function passwordMeetsRequirements(password: string) {
    return password.length >= 16
        && /[A-Z]/.test(password) && /[a-z]/.test(password)
        && /[0-9]/.test(password) && /[^a-zA-Z0-9\s]/.test(password)
}
