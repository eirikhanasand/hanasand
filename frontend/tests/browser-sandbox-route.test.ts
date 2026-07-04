import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import path from 'node:path'

const root = process.cwd()

test('regular browser sandbox route and broker contract are wired', () => {
    const routeSource = readFileSync(path.join(root, 'src/app/solutions/browser-sandbox/page.tsx'), 'utf8')
    const clientSource = readFileSync(path.join(root, 'src/app/solutions/browser-sandbox/pageClient.tsx'), 'utf8')
    const solutionsSource = readFileSync(path.join(root, 'src/app/solutions/page.tsx'), 'utf8')
    const wsSource = readFileSync(path.join(root, '../api/src/plugins/ws.ts'), 'utf8')
    const brokerSource = readFileSync(path.join(root, '../api/src/handlers/onionSession/ws.ts'), 'utf8')

    assert(routeSource.includes('path: \'/solutions/browser-sandbox\''), 'browser sandbox route metadata should use the public route path.')
    assert(routeSource.includes('<BrowserSandboxPageClient />'), 'browser sandbox route should render the client.')
    assert(solutionsSource.includes('href: \'/solutions/browser-sandbox\''), 'solutions page should link to the browser sandbox.')
    assert(clientSource.includes('Regular Website Sandbox'), 'client should expose the URL-first sandbox surface.')
    assert(clientSource.includes('NEXT_PUBLIC_BROWSER_SANDBOX_WS'), 'client should use the regular sandbox websocket endpoint.')
    assert(clientSource.includes('VirusTotal'), 'default profile should include VirusTotal.')
    assert(clientSource.includes('urlquery'), 'default profile should include urlquery.')
    assert(clientSource.includes('WebCrack'), 'default profile should include WebCrack.')
    assert(clientSource.includes('Screenshot timeline'), 'client should expose screenshot timeline output.')
    assert(clientSource.includes('SOC analyst summary'), 'client should expose analyst summary output.')
    assert(clientSource.includes('window.localStorage.setItem'), 'client should persist saved profiles locally.')
    assert(clientSource.includes('Copyable indicators'), 'client should expose copyable indicator output.')
    assert(clientSource.includes('SandboxEvidence'), 'client should model backend-rendered sandbox evidence.')
    assert(clientSource.includes('deobfuscationTasks'), 'client should surface WebCrack-ready deobfuscation tasks.')
    assert(clientSource.includes('Obfuscated scripts'), 'client should summarize obfuscated script findings.')
    assert(clientSource.includes('Suspicious captures'), 'client should summarize suspicious rendered evidence.')

    assert(wsSource.includes('/api/ws/browser-sandbox/:id'), 'API websocket plugin should register the regular sandbox route.')
    assert(wsSource.includes('handleOnionSessionSocket(connection, req.params.id, \'regular\')'), 'regular sandbox route should force regular network mode.')
    assert(brokerSource.includes('network?: \'tor\' | \'regular\''), 'broker should support regular network mode.')
    assert(brokerSource.includes('profileTools'), 'broker should accept saved-profile tool URLs.')
    assert(brokerSource.includes('tool_capture'), 'broker should emit profile tool captures.')
    assert(brokerSource.includes('capturedAt'), 'broker should emit screenshot timestamps.')
    assert(brokerSource.includes('page.on(\'framenavigated\''), 'broker should capture active URL changes and redirects.')
    assert(brokerSource.includes('collectPageEvidence'), 'broker should extract rendered page evidence.')
    assert(brokerSource.includes('obfuscatedScripts'), 'broker should identify obfuscated script candidates.')
    assert(brokerSource.includes('deobfuscationTasks'), 'broker should emit WebCrack-ready script samples.')
    assert(brokerSource.includes('extractIndicators'), 'broker should extract domains, IPs, and URLs for later-stage analysis.')
})
