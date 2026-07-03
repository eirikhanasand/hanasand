import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
]

const colorSchemes = ['dark', 'light']

const authFixture = {
    header: 'local-dashboard-render-proof',
    id: 'dashboard-render-proof-user',
    name: 'Logs UI Proof',
    token: 'local-dashboard-render-proof-token',
    roles: [{ id: 'admin' }, { id: 'system_admin' }],
}

function parseArgs(argv) {
    const options = {
        baseUrl: 'http://127.0.0.1:3000',
        outDir: '/tmp/hanasand-logs-ui',
        jsonPath: '',
    }
    for (const arg of argv) {
        if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length).replace(/\/$/, '')
        if (arg.startsWith('--out-dir=')) options.outDir = arg.slice('--out-dir='.length)
        if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length)
    }
    options.jsonPath ||= path.join(options.outDir, 'hanasand-logs-ui-proof.json')
    return options
}

function cookieUrl(baseUrl) {
    return new URL(baseUrl).origin
}

function screenshotPath(outDir, viewportName, colorScheme) {
    return path.join(outDir, `hanasand-logs-${viewportName}-${colorScheme}.png`)
}

async function clickTabUntilSelected(page, key) {
    const tab = page.locator(`[data-logs-tab="${key}"]`).first()
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await tab.click()
        if (await tab.evaluate(element => element.getAttribute('aria-selected') === 'true').catch(() => false)) return
        await page.waitForTimeout(150 + attempt * 100)
    }
    await tab.click()
}

async function inspectLogsPage(page) {
    const result = await page.evaluate(() => {
        const selectors = [
            'main',
            '[data-logs-dashboard]',
            '[data-logs-toolbar]',
            '[data-logs-tabs]',
            '[data-logs-service-filter]',
            '[data-logs-metrics]',
            '[data-logs-metric-card]',
            '[data-logs-feed]',
        ]
        const selectorCounts = Object.fromEntries(selectors.map(selector => [selector, document.querySelectorAll(selector).length]))
        const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        const clippedTextCount = Array.from(document.querySelectorAll('button, [data-logs-toolbar], [data-logs-metric-card], [data-logs-feed]'))
            .filter((element) => element.scrollWidth > element.clientWidth + 2 && (element.textContent || '').trim().length > 12)
            .length

        return {
            selectorCounts,
            horizontalOverflow,
            clippedTextCount,
            bodyText: document.body.innerText,
        }
    })

    const reasons = []
    for (const [selector, count] of Object.entries(result.selectorCounts)) {
        if (!count) reasons.push(`missing selector: ${selector}`)
    }
    if (result.selectorCounts['[data-logs-metric-card]'] < 4) reasons.push(`missing metric cards: ${result.selectorCounts['[data-logs-metric-card]']}`)
    if (result.horizontalOverflow > 1) reasons.push(`horizontal overflow: ${result.horizontalOverflow}`)
    if (result.clippedTextCount) reasons.push(`clipped logs text/control count: ${result.clippedTextCount}`)
    if (/glass-card|rounded-\[1\.|tracking-\[|text-bright|bg-black\/|border-white\//.test(result.bodyText)) {
        reasons.push('legacy generated-style copy or classes are visible')
    }

    return { ...result, reasons }
}

async function exerciseLogsInteractions(page) {
    const expectedTabs = [
        { key: 'dashboard', text: 'Most active stored services' },
        { key: 'errors', text: 'Recent error codes' },
        { key: 'live', text: 'Realtime runtime feed' },
        { key: 'stored', text: 'Stored and searchable error records' },
    ]
    const reasons = []

    for (const tab of expectedTabs) {
        await clickTabUntilSelected(page, tab.key)
        const visible = await page.getByText(tab.text).first().isVisible().catch(() => false)
        if (!visible) reasons.push(`missing tab view text: ${tab.key}`)
    }

    const serviceFilter = page.locator('[data-logs-service-filter]')
    const initialValue = await serviceFilter.inputValue().catch(() => '')
    if (initialValue !== 'api') reasons.push(`service query did not initialize filter: ${initialValue || 'empty'}`)
    await serviceFilter.selectOption('all')
    await page.waitForFunction(() => {
        const select = document.querySelector('[data-logs-service-filter]')
        return select instanceof HTMLSelectElement && select.value === 'all' && !new URL(location.href).searchParams.has('service')
    }, null, { timeout: 5000 }).catch(() => {})
    const selectedValue = await serviceFilter.inputValue().catch(() => '')
    if (selectedValue !== 'all') reasons.push(`service filter did not switch to all: ${selectedValue || 'empty'}`)
    if (new URL(page.url()).searchParams.has('service')) reasons.push('service filter did not clear service query param')

    return reasons
}

async function gotoLogsPage(page, url) {
    let lastError
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
            await page.locator('[data-logs-toolbar]').waitFor({ state: 'attached', timeout: 30000 })
            return
        } catch (error) {
            lastError = error
            await page.waitForTimeout(700 * (attempt + 1))
        }
    }
    throw lastError
}

async function run() {
    const options = parseArgs(process.argv.slice(2))
    await mkdir(options.outDir, { recursive: true })
    const artifact = {
        schema: 'hanasand.logs.ui-proof.v1',
        generatedAt: new Date().toISOString(),
        baseUrl: options.baseUrl,
        pages: [],
        summary: { passed: false, failureReasons: [], artifactPath: options.jsonPath, screenshotPaths: [] },
    }

    const browser = await chromium.launch({ headless: true })
    try {
        for (const colorScheme of colorSchemes) {
            for (const viewport of viewports) {
                const context = await browser.newContext({
                    viewport,
                    colorScheme,
                    extraHTTPHeaders: { 'x-hanasand-render-proof-auth': authFixture.header },
                })
                await context.addCookies([
                    { name: 'id', value: encodeURIComponent(authFixture.id), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'name', value: encodeURIComponent(authFixture.name), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'access_token', value: encodeURIComponent(authFixture.token), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'roles', value: encodeURIComponent(JSON.stringify(authFixture.roles)), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'email', value: encodeURIComponent('logs-ui-proof@hanasand.local'), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'theme', value: colorScheme, url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                ])
                await context.addInitScript((scheme) => {
                    document.documentElement.classList.toggle('dark', scheme === 'dark')
                    document.documentElement.classList.toggle('light', scheme === 'light')
                    window.localStorage.setItem('theme', scheme)
                }, colorScheme)

                const page = await context.newPage()
                const imagePath = screenshotPath(options.outDir, viewport.name, colorScheme)
                artifact.summary.screenshotPaths.push(imagePath)
                const pageResult = {
                    viewport,
                    colorScheme,
                    screenshotPath: imagePath,
                    passed: false,
                    reasons: [],
                }
                try {
                    await gotoLogsPage(page, `${options.baseUrl}/dashboard/logs?service=api`)
                    pageResult.reasons.push(...await exerciseLogsInteractions(page))
                    Object.assign(pageResult, await inspectLogsPage(page))
                    await page.screenshot({ path: imagePath, fullPage: true, timeout: 60000 })
                    pageResult.passed = pageResult.reasons.length === 0
                } catch (error) {
                    pageResult.reasons.push(error instanceof Error ? error.message : String(error))
                } finally {
                    await context.close()
                }
                artifact.pages.push(pageResult)
            }
        }
    } finally {
        await browser.close()
    }

    for (const pageResult of artifact.pages) {
        for (const reason of pageResult.reasons) {
            artifact.summary.failureReasons.push(`${pageResult.colorScheme}/${pageResult.viewport.name}: ${reason}`)
        }
    }
    artifact.summary.passed = artifact.summary.failureReasons.length === 0
    await writeFile(options.jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(artifact, null, 2))
    assert.equal(artifact.summary.passed, true, `Logs UI proof failed; see ${options.jsonPath}`)
}

void run()
