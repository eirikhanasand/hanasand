import packagejson from '../package.json'

const defaultPublicApiUrl = 'https://api.hanasand.com/api'
const defaultPublicCdnUrl = 'https://cdn.hanasand.com/api'
const configuredPublicApiUrl = process.env.NEXT_PUBLIC_API || defaultPublicApiUrl
const publicApiUrl = process.env.NODE_ENV === 'production' && isLocalUrl(configuredPublicApiUrl)
    ? defaultPublicApiUrl
    : configuredPublicApiUrl
const internalApiUrl =
    process.env.FRONTEND_INTERNAL_API ||
    process.env.INTERNAL_API ||
    publicApiUrl
const internalCdnUrl =
    process.env.FRONTEND_INTERNAL_CDN ||
    process.env.INTERNAL_CDN ||
    ''

const config = {
    url: {
        api: resolveApiUrl(),
        auth: process.env.FRONTEND_AUTH_API || internalApiUrl,
        api_wss: process.env.NEXT_PUBLIC_API_WS || 'wss://api.hanasand.com/api/ws',
        api_client_wss: toWsUrl(resolveApiUrl()),
        cdn_wss: process.env.NEXT_PUBLIC_CDN_WS || toWsUrl(resolveCdnUrl()).replace(/\/api$/, '/api/ws'),
        cdn: resolveCdnUrl(),
        internal: process.env.NEXT_PUBLIC_INTERNAL_API || process.env.INTERNAL_API || internalApiUrl,
        link: process.env.NEXT_PUBLIC_LINK || 'https://hanasand.com/g',
    },
    version: packagejson.version,
    abortTimeout: 3000
}

export default config

function resolveApiUrl() {
    if (typeof window === 'undefined') {
        return resolveServerApiUrl(internalApiUrl)
    }

    const { hostname, protocol } = window.location
    if (process.env.NEXT_PUBLIC_API && !shouldIgnoreBrowserPublicApi(process.env.NEXT_PUBLIC_API, hostname)) {
        return process.env.NEXT_PUBLIC_API
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:8080/api`
    }

    return publicApiUrl
}

function resolveServerApiUrl(url: string) {
    return process.env.NODE_ENV === 'production' && isLoopbackUrl(url)
        ? publicApiUrl
        : url
}

function resolveCdnUrl() {
    if (typeof window === 'undefined') {
        if (process.env.NEXT_PUBLIC_CDN) {
            return process.env.NEXT_PUBLIC_CDN
        }

        if (internalCdnUrl) {
            return internalCdnUrl
        }

        if (internalApiUrl) {
            return internalApiUrl
        }

        return defaultPublicCdnUrl
    }

    if (process.env.NEXT_PUBLIC_CDN) {
        return process.env.NEXT_PUBLIC_CDN
    }

    const { hostname, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:8080/api`
    }

    return defaultPublicCdnUrl
}

function toWsUrl(url: string) {
    if (url.startsWith('https://')) {
        return `wss://${url.slice('https://'.length)}`
    }

    if (url.startsWith('http://')) {
        return `ws://${url.slice('http://'.length)}`
    }

    return url
}

function isLocalUrl(url: string) {
    try {
        const parsed = new URL(url)
        return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'api'
    } catch {
        return false
    }
}

function shouldIgnoreBrowserPublicApi(url: string, hostname: string) {
    return process.env.NODE_ENV === 'production'
        && isLocalUrl(url)
        && hostname !== 'localhost'
        && hostname !== '127.0.0.1'
}

function isLoopbackUrl(url: string) {
    try {
        const parsed = new URL(url)
        return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    } catch {
        return false
    }
}
