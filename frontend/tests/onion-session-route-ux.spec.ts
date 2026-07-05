import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('legacy onion and regular sandbox routes redirect to the unified browser workspace', async () => {
    const onionRouteSource = await readFile(path.join(root, 'src/app/solutions/onion-session/page.tsx'), 'utf8')
    const regularRouteSource = await readFile(path.join(root, 'src/app/solutions/browser-sandbox/page.tsx'), 'utf8')
    const browserRouteSource = await readFile(path.join(root, 'src/app/solutions/browser/page.tsx'), 'utf8')
    const browserClientSource = await readFile(path.join(root, 'src/app/solutions/browser/pageClient.tsx'), 'utf8')
    const solutionsSource = await readFile(path.join(root, 'src/app/solutions/page.tsx'), 'utf8')
    const headerSource = await readFile(path.join(root, 'src/components/header/header.tsx'), 'utf8')
    const footerSource = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    assert(onionRouteSource.includes('redirect(\'/solutions/browser\')'))
    assert(regularRouteSource.includes('redirect(\'/solutions/browser\')'))
    assert(browserRouteSource.includes('path: \'/solutions/browser\''))
    assert(browserRouteSource.includes('<BrowserPageClient />'))
    assert(solutionsSource.includes('href: \'/solutions/browser\''))
    assert(headerSource.includes('href: \'/solutions/browser\''))
    assert(footerSource.includes('href: \'/solutions/browser\''))

    assert(browserClientSource.includes('Browser'))
    assert(browserClientSource.includes('NetworkSegment'))
    assert(browserClientSource.includes('Regular'))
    assert(browserClientSource.includes('Tor'))
    assert(browserClientSource.includes('Auto-detected route'))
    assert(browserClientSource.includes('id=\'sandbox-url\''))
    assert(browserClientSource.includes('SOC analyst summary'))
    assert(browserClientSource.includes('HistoryPanel'))
    assert(!browserClientSource.includes('This page is not available'))
})

test('unified browser app chrome uses shared theme tokens', async () => {
    const clientSource = await readFile(path.join(root, 'src/app/solutions/browser/pageClient.tsx'), 'utf8')
    const jsxChrome = clientSource
        .replace(/context\.(?:fillStyle|strokeStyle)\s*=\s*'#[^']+'/g, '')
        .replace(/drawRoundedRect\([\s\S]+?#[\s\S]+?\)/g, '')

    assert(jsxChrome.includes('bg-ui-canvas'))
    assert(jsxChrome.includes('border-ui-border'))
    assert(jsxChrome.includes('text-ui-text'))
    assert(jsxChrome.includes('bg-ui-primary'))
    assert(!/\b(?:border|bg|text|shadow|hover:bg|hover:border|focus:ring|accent)-\[#/.test(jsxChrome))
    assert(!/\b(?:red|orange|amber|emerald|slate|gray)-[0-9]/.test(jsxChrome))
})
