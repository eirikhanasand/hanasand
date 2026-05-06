import packagejson from '../package.json'

const defaultPublicApiUrl = 'https://api.hanasand.com/api'
const publicApiUrl = process.env.NEXT_PUBLIC_API || defaultPublicApiUrl
const internalApiUrl =
    process.env.FRONTEND_INTERNAL_API ||
    process.env.INTERNAL_API ||
    publicApiUrl

const config = {
    url: {
        api: resolveApiUrl(),
        auth: process.env.FRONTEND_AUTH_API || defaultPublicApiUrl,
        api_wss: process.env.NEXT_PUBLIC_API_WS || 'wss://api.hanasand.com/api/ws',
        api_client_wss: toWsUrl(resolveApiUrl()),
        beekeeper: process.env.NEXT_PUBLIC_BEEKEEPER_API || process.env.BEEKEEPER_API_URL || 'https://beekeeper.login.no/api',
        cdn_wss: process.env.NEXT_PUBLIC_CDN_WS || 'wss://cdn.hanasand.com/api/ws',
        cdn: process.env.NEXT_PUBLIC_CDN || 'https://cdn.hanasand.com/api',
        internal: process.env.NEXT_PUBLIC_INTERNAL_API || process.env.INTERNAL_API || 'https://internal.hanasand.com/api',
        link: process.env.NEXT_PUBLIC_LINK || 'https://hanasand.com/g',
    },
    version: packagejson.version,
    abortTimeout: 3000
}

export default config

function resolveApiUrl() {
    if (typeof window === 'undefined') {
        return internalApiUrl
    }

    if (process.env.NEXT_PUBLIC_API) {
        return process.env.NEXT_PUBLIC_API
    }

    const { hostname, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:8080/api`
    }

    return publicApiUrl
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
