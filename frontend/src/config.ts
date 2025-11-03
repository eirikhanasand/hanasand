import packagejson from '../package.json'

const config = {
    url: {
        // api: 'http://localhost:8080/api',
        api: 'https://api.hanasand.com/api',
        // api_ws: 'ws://localhost:8080/api',
        api_ws: 'wss://api.hanasand.com/api',
        cdn_ws: 'wss://cdn.hanasand.com/api',
        // cdn_ws: 'ws://localhost:8501/api',
        cdn: 'https://cdn.hanasand.com/api',
        // cdn: 'http://localhost:8501/api',
        link: 'https://hanasand.com/g',
        internal_wss: 'wss://internal.hanasand.com/api',
    },
    version: packagejson.version
}

export default config
