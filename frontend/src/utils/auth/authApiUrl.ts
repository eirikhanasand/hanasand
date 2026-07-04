const defaultAuthApiUrl = 'https://api.hanasand.com/api'

export function authApiUrl() {
    const serverConfigured = process.env.FRONTEND_AUTH_API || process.env.FRONTEND_INTERNAL_API || process.env.INTERNAL_API
    if (serverConfigured) return serverConfigured

    const configured = process.env.NEXT_PUBLIC_API || defaultAuthApiUrl
    return isLoopbackApiUrl(configured) && process.env.NODE_ENV === 'production'
        ? defaultAuthApiUrl
        : configured
}

function isLoopbackApiUrl(value: string) {
    try {
        const url = new URL(value)
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    } catch {
        return false
    }
}
