import packagejson from "../package.json"

const config = {
    url: {
        api: 'https://api.hanasand.com/api',
        api_ws: 'wss://api.hanasand.com/api',
        cdn: 'https://cdn.hanasand.com/api',
    },
    version: packagejson.version
}

export default config
