import packagejson from '../package.json'

const config = {
    url: {
        // api: 'http://localhost:8080/api',
        api: 'https://api.hanasand.com/api',
        // api_ws: 'ws://localhost:8080/api/ws',
        api_ws: 'wss://api.hanasand.com/api/ws',
        cdn_ws: 'wss://cdn.hanasand.com/api/ws',
        // cdn_ws: 'ws://localhost:8501/api/ws',
        cdn: 'https://cdn.hanasand.com/api',
        // cdn: 'http://localhost:8501/api',
        link: 'https://hanasand.com/g',
    },
    version: packagejson.version
}

export default config
