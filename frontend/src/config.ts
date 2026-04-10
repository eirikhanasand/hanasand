import packagejson from '../package.json'

const publicApiUrl = process.env.NEXT_PUBLIC_API || 'https://api.hanasand.com/api'
const internalApiUrl =
    process.env.FRONTEND_INTERNAL_API ||
    process.env.INTERNAL_API ||
    publicApiUrl

const config = {
    url: {
        api: typeof window === 'undefined' ? internalApiUrl : publicApiUrl,
        api_wss: process.env.NEXT_PUBLIC_API_WS || 'wss://api.hanasand.com/api/ws',
        api_client_wss: toWsUrl(publicApiUrl),
        cdn_wss: process.env.NEXT_PUBLIC_CDN_WS || 'wss://cdn.hanasand.com/api/ws',
        cdn: process.env.NEXT_PUBLIC_CDN || 'https://cdn.hanasand.com/api',
        link: process.env.NEXT_PUBLIC_LINK || 'https://hanasand.com/g',
    },
    version: packagejson.version,
    abortTimeout: 3000
}

export default config

function toWsUrl(url: string) {
    if (url.startsWith('https://')) {
        return `wss://${url.slice('https://'.length)}`
    }

    if (url.startsWith('http://')) {
        return `ws://${url.slice('http://'.length)}`
    }

    return url
}
