import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '../..')
const frontendRoot = path.join(root, 'frontend')

const browserRoute = readFileSync(path.join(frontendRoot, 'src/app/browser/page.tsx'), 'utf8')
const browserClient = readFileSync(path.join(frontendRoot, 'src/app/browser/pageClient.tsx'), 'utf8')
const legacyOnionRoute = readFileSync(path.join(frontendRoot, 'src/app/solutions/onion-session/page.tsx'), 'utf8')
const legacyRegularRoute = readFileSync(path.join(frontendRoot, 'src/app/browser-sandbox/page.tsx'), 'utf8')
const wsPlugin = readFileSync(path.join(root, 'api/src/plugins/ws.ts'), 'utf8')
const broker = readFileSync(path.join(root, 'api/src/handlers/onionSession/ws.ts'), 'utf8')

assert(browserRoute.includes('path: \'/browser\''))
assert(browserRoute.includes('<BrowserPageClient />'))
assert(legacyOnionRoute.includes('redirect(\'/browser\')'))
assert(legacyRegularRoute.includes('redirect(\'/browser\')'))

assert(browserClient.includes('Browser'))
assert(browserClient.includes('BrowserNetwork'))
assert(browserClient.includes('inferNetwork'))
assert(browserClient.includes('BrowserFingerprint'))
assert(browserClient.includes('SlidersHorizontal'))
assert(browserClient.includes('id=\'sandbox-url\''))
assert(browserClient.includes('Interactive isolated browser viewport'))
assert(browserClient.includes('type: \'click\''))
assert(browserClient.includes('type: \'wheel\''))
assert(browserClient.includes('type: \'key\''))
assert(browserClient.includes('type: \'clipboard\''))
assert(browserClient.includes('Console logs'))
assert(browserClient.includes('HistoryPanel'))
assert(browserClient.includes('/api/backend/browser/runs'))

assert(wsPlugin.includes('/api/ws/browser/:id'))
assert(broker.includes('requestBrowserAdmission(sessionId, send)'))
assert(!broker.includes('network === \'regular\' ? requestBrowserAdmission'))

console.log(JSON.stringify({
    ok: true,
    route: '/browser',
    legacyRoutesRedirect: ['/solutions/onion-session', '/browser-sandbox'],
    unifiedViewport: true,
    sharedQueue: true,
}, null, 2))
