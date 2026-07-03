import { readFileSync } from 'node:fs'

const routes = read('src/routes.ts')
const handler = read('src/handlers/traffic/legacy.ts')
const recorder = read('src/utils/traffic/recordTraffic.ts')
const schema = read('src/utils/db/ensureSchema.ts')

assert(routes.includes('fastify.get(\'/traffic/live\', getLegacyTrafficLive)'), 'Missing /traffic/live route registration')
assert(handler.includes('text/event-stream'), 'Traffic live handler must stream SSE')
assert(handler.includes('country_iso AS iso'), 'Traffic live stream must group by country_iso')
assert(handler.includes('country_iso,'), 'Traffic records must return country_iso for map hydration')
assert(recorder.includes('req.headers[\'cf-ipcountry\']'), 'Traffic recorder must capture Cloudflare country header')
assert(recorder.includes('req.headers[\'x-vercel-ip-country\']'), 'Traffic recorder must capture Vercel country header')
assert(schema.includes('country_iso TEXT'), 'Traffic schema must include country_iso')

console.log('traffic live stream contract ok')

function read(path: string) {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assert(condition: unknown, message: string) {
    if (!condition) {
        throw new Error(message)
    }
}
