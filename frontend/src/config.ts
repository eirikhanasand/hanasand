import packagejson from "../package.json"

const config = {
    url: {
        api: 'https://api.hanasand.com/api',
        cdn_ws: 'wss://cdn.hanasand.com/api',
        // cdn_ws: 'ws://localhost:8501/api',
        cdn: 'https://cdn.hanasand.com/api',
        // cdn: 'http://localhost:8501/api',
    },
    version: packagejson.version
}

export default config
