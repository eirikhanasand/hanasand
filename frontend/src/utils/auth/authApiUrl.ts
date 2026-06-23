const defaultAuthApiUrl = 'https://api.hanasand.com/api'

export function authApiUrl() {
    const configured = process.env.FRONTEND_AUTH_API || process.env.NEXT_PUBLIC_API || defaultAuthApiUrl
    return isLocalApiUrl(configured) && process.env.NODE_ENV === 'production'
        ? defaultAuthApiUrl
        : configured
}

function isLocalApiUrl(value: string) {
    try {
        const url = new URL(value)
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === 'api'
    } catch {
        return false
    }
}
