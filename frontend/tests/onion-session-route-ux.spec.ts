import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('onion session route is linked and exposes the remote browser workspace', async () => {
    const routeSource = await readFile(path.join(root, 'src/app/solutions/onion-session/page.tsx'), 'utf8')
    const clientSource = await readFile(path.join(root, 'src/app/solutions/onion-session/pageClient.tsx'), 'utf8')
    const solutionsSource = await readFile(path.join(root, 'src/app/solutions/page.tsx'), 'utf8')
    const headerSource = await readFile(path.join(root, 'src/components/header/header.tsx'), 'utf8')
    const footerSource = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    expect(routeSource).toContain('path: \'/solutions/onion-session\'')
    expect(routeSource).toContain('<OnionSessionPageClient />')
    expect(solutionsSource).toContain('href: \'/solutions/onion-session\'')
    expect(headerSource).toContain('href: \'/solutions/onion-session\'')
    expect(footerSource).toContain('href: \'/solutions/onion-session\'')

    expect(clientSource).toContain('Remote Tor Browser')
    expect(clientSource).toContain('id=\'tor-remote-desktop\'')
    expect(clientSource).toContain('data-onion-action=\'start\'')
    expect(clientSource).toContain('data-onion-action=\'enable-clipboard\'')
    expect(clientSource).toContain('Interactive remote Tor browser viewport')
    expect(clientSource).not.toContain('This page is not available')
})

test('onion session app chrome uses shared theme tokens', async () => {
    const clientSource = await readFile(path.join(root, 'src/app/solutions/onion-session/pageClient.tsx'), 'utf8')
    const jsxChrome = clientSource
        .replace(/context\.(?:fillStyle|strokeStyle)\s*=\s*'#[^']+'/g, '')
        .replace(/drawRoundedRect\([\s\S]+?#[\s\S]+?\)/g, '')

    expect(jsxChrome).toContain('bg-ui-canvas')
    expect(jsxChrome).toContain('border-ui-border')
    expect(jsxChrome).toContain('text-ui-text')
    expect(jsxChrome).toContain('bg-ui-primary')
    expect(jsxChrome).not.toMatch(/\b(?:border|bg|text|shadow|hover:bg|hover:border|focus:ring|accent)-\[#/)
    expect(jsxChrome).not.toMatch(/\b(?:red|orange|amber|emerald|slate|gray)-[0-9]/)
})

test('regular browser sandbox route exposes URL-first SOC triage workflow', async () => {
    const routeSource = await readFile(path.join(root, 'src/app/solutions/browser-sandbox/page.tsx'), 'utf8')
    const clientSource = await readFile(path.join(root, 'src/app/solutions/browser-sandbox/pageClient.tsx'), 'utf8')
    const solutionsSource = await readFile(path.join(root, 'src/app/solutions/page.tsx'), 'utf8')
    const wsSource = await readFile(path.join(root, '../api/src/plugins/ws.ts'), 'utf8')
    const brokerSource = await readFile(path.join(root, '../api/src/handlers/onionSession/ws.ts'), 'utf8')

    expect(routeSource).toContain('path: \'/solutions/browser-sandbox\'')
    expect(routeSource).toContain('<BrowserSandboxPageClient />')
    expect(solutionsSource).toContain('href: \'/solutions/browser-sandbox\'')
    expect(clientSource).toContain('Regular Website Sandbox')
    expect(clientSource).toContain('NEXT_PUBLIC_BROWSER_SANDBOX_WS')
    expect(clientSource).toContain('VirusTotal')
    expect(clientSource).toContain('urlquery')
    expect(clientSource).toContain('WebCrack')
    expect(clientSource).toContain('Screenshot timeline')
    expect(clientSource).toContain('SOC analyst summary')
    expect(clientSource).toContain('localStorage.setItem')

    expect(wsSource).toContain('/api/ws/browser-sandbox/:id')
    expect(wsSource).toContain('handleOnionSessionSocket(connection, req.params.id, \'regular\')')
    expect(brokerSource).toContain("network?: 'tor' | 'regular'")
    expect(brokerSource).toContain('profileTools')
    expect(brokerSource).toContain('tool_capture')
    expect(brokerSource).toContain('capturedAt')
})
