import packagejson from '../package.json'

const config = {
    url: {
        api: process.env.NEXT_PUBLIC_API || 'https://api.hanasand.com/api',
        api_ws: process.env.NEXT_PUBLIC_API_WS || 'wss://api.hanasand.com/api/ws',
        cdn_ws: process.env.NEXT_PUBLIC_CDN_WS || 'wss://cdn.hanasand.com/api/ws',
        cdn: process.env.NEXT_PUBLIC_CDN || 'https://cdn.hanasand.com/api',
        link: process.env.NEXT_PUBLIC_LINK || 'https://hanasand.com/g',
    },
    version: packagejson.version,
    abortTimeout: 3000
}

export default config
