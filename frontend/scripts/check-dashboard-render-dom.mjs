import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const expectedRows = {
    dashboard_evidence: '/dashboard',
    source_inventory_probe: '/dashboard/ti/sources',
    dwm_product_snapshot: '/dashboard/dwm',
    entitlement_readiness: '/dashboard/dwm',
    webhook_delivery: '/dashboard/automations?setup=dwm',
    org_alert_export: '/dashboard/dwm',
    webhook_health: '/dashboard/automations?setup=dwm',
    helpdesk_audit: '/dashboard/system/impersonation',
    deploy_probe: '/status',
    public_ti_provenance: '/ti',
}

const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
]

const pageSpecs = [
    {
        id: 'dashboard',
        path: '/dashboard',
        requiredSelectors: ['[data-readiness-row-id]', '[data-readiness-owner-lane]', '[data-readiness-operator-action]', '[data-readiness-backend-proof-contract-version]', '[data-readiness-priority]', '[data-readiness-detail]', '[data-readiness-scorecard-link="/readiness"]'],
    },
    {
        id: 'dashboard_ti_control',
        path: '/dashboard/ti/control',
        requiredSelectors: ['.source-ops-workbench', 'button'],
    },
]

const bannedCopy = [
    'control room',
    'prompt-shaped',
    'acceptance criteria',
    'coordinator',
    'delegation',
    'you are tasked',
    'worker 3',
    'ti control room',
    'how this feeds',
    '/ti/<query>',
    'dashboard slop',
    'signal',
    'dashboard handoff',
    'backed handoff',
    'apt29',
    'lockbit',
]

const highContrastDarkTokens = ['border-white/', 'bg-white/10', 'bg-white/15']
const localAuthFixture = {
    header: 'local-dashboard-render-proof',
    id: 'dashboard-render-proof-user',
    name: 'Dashboard Render Proof',
    token: 'local-dashboard-render-proof-token',
    roles: [{ id: 'admin' }, { id: 'system_admin' }],
}

function parseArgs(argv) {
    const options = {
        baseUrl: 'http://127.0.0.1:3010',
        outDir: '/tmp',
        jsonPath: '',
    }
    for (const arg of argv) {
        if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length).replace(/\/$/, '')
        if (arg.startsWith('--out-dir=')) options.outDir = arg.slice('--out-dir='.length)
        if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length)
        if (arg === '--help') {
            console.log('Usage: node scripts/check-dashboard-render-dom.mjs --base-url=http://127.0.0.1:3010 --out-dir=/tmp')
            process.exit(0)
        }
    }
    options.jsonPath ||= path.join(options.outDir, 'hanasand-dashboard-render-proof.json')
    return options
}

function screenshotPath(outDir, pageId, viewportName) {
    return path.join(outDir, `hanasand-${pageId}-${viewportName}.png`)
}

function pageUrl(baseUrl, pagePath) {
    return `${baseUrl}${pagePath}`
}

function cookieUrl(baseUrl) {
    return new URL(baseUrl).origin
}

function resultSkeleton(spec, viewport, imagePath) {
    return {
        pageId: spec.id,
        path: spec.path,
        viewport,
        screenshotPath: imagePath,
        passed: false,
        reasons: [],
        selectorCounts: {},
        overlapCount: 0,
        narrowActionCount: 0,
        clippedTextCount: 0,
        bannedCopyList: [],
        highContrastTokenHits: [],
        consoleWarnings: [],
        readinessRows: {},
    }
}

async function inspectRenderedPage(page, spec) {
    return page.evaluate(({ bannedCopyValues, highContrastValues, requiredSelectors, expectedReadinessRows }) => {
        const reasons = []
        const selectorCounts = {}
        const bodyText = document.body.innerText.toLowerCase()
        if (location.pathname === '/login' || bodyText.includes('login') && bodyText.includes('password')) {
            reasons.push('rendered login screen; dashboard auth fixture was not accepted')
        }
        const bannedCopyList = bannedCopyValues.filter(value => bodyText.includes(value))
        for (const phrase of bannedCopyList) {
            reasons.push(`visible banned copy: ${phrase}`)
        }

        for (const selector of requiredSelectors) {
            selectorCounts[selector] = document.querySelectorAll(selector).length
            if (!selectorCounts[selector]) reasons.push(`missing selector: ${selector}`)
        }

        const classText = Array.from(document.querySelectorAll('[class]')).map(node => String(node.getAttribute('class') || '')).join(' ')
        const highContrastTokenHits = highContrastValues.filter(value => classText.includes(value))
        for (const token of highContrastTokenHits) {
            reasons.push(`high-contrast dark token: ${token}`)
        }

        const readinessRows = {}
        if (location.pathname === '/dashboard') {
            const isMobileViewport = window.innerWidth < 640
            const mobileSidebar = document.querySelector('.dashboard-sidebar-sticky')
            const mobileSidebarRect = mobileSidebar ? visibleRect(mobileSidebar) : null
            if (isMobileViewport && mobileSidebarRect) {
                reasons.push('mobile dashboard renders expanded navigation before the workbench')
            }
            const analystQueue = document.querySelector('[role="listbox"][aria-label="Analyst work queue"]')
            const analystQueueRect = analystQueue ? visibleRect(analystQueue) : null
            if (isMobileViewport && (!analystQueueRect || analystQueueRect.top > 360)) {
                reasons.push(`mobile work queue starts too low: ${analystQueueRect ? Math.round(analystQueueRect.top) : 'missing'}`)
            }
            const queueScroller = analystQueue?.parentElement
            const queueScrollerStyle = queueScroller ? window.getComputedStyle(queueScroller) : null
            if (isMobileViewport && queueScrollerStyle && ['auto', 'scroll'].includes(queueScrollerStyle.overflowY)) {
                reasons.push('mobile work queue uses an internal scroll container before selected detail')
            }
            const detail = document.querySelector('[data-readiness-detail]')
            if (!detail) {
                reasons.push('missing readiness detail panel')
            } else {
                for (const attr of ['data-readiness-detail-owner', 'data-readiness-detail-action', 'data-readiness-detail-proof', 'data-readiness-detail-href']) {
                    if (!detail.getAttribute(attr)) reasons.push(`readiness detail missing ${attr}`)
                }
                if (detail.getAttribute('data-readiness-detail-state') !== 'ready' && !detail.getAttribute('data-readiness-detail-blocker')) {
                    reasons.push('readiness detail missing blocker')
                }
            }
            for (const [id, href] of Object.entries(expectedReadinessRows)) {
                const row = document.querySelector(`[data-readiness-row-id="${id}"]`)
                if (!row) {
                    reasons.push(`missing readiness row: ${id}`)
                    readinessRows[id] = { present: false }
                    continue
                }
                const state = row.getAttribute('data-readiness-state') || ''
                const blockerCountText = row.getAttribute('data-readiness-blocker-count')
                const blockerCount = Number(blockerCountText)
                const deepLinkTarget = row.getAttribute('data-readiness-deep-link-target') || ''
                const ownerLane = row.getAttribute('data-readiness-owner-lane') || ''
                const operatorAction = row.getAttribute('data-readiness-operator-action') || ''
                const unavailableReason = row.getAttribute('data-readiness-unavailable-reason') || ''
                const proofTimestamp = row.getAttribute('data-readiness-proof-timestamp') || ''
                const staleAfterSecondsText = row.getAttribute('data-readiness-stale-after-seconds')
                const staleAfterSeconds = Number(staleAfterSecondsText)
                const expectedDashboardRowId = row.getAttribute('data-readiness-expected-dashboard-row-id') || ''
                const integrationProbeHint = row.getAttribute('data-readiness-integration-probe-hint') || ''
                const backendProofContractVersion = row.getAttribute('data-readiness-backend-proof-contract-version') || ''
                readinessRows[id] = {
                    present: true,
                    state,
                    blockerCount,
                    deepLinkTarget,
                    ownerLane,
                    operatorAction,
                    unavailableReason,
                    proofTimestamp,
                    staleAfterSeconds,
                    expectedDashboardRowId,
                    integrationProbeHint,
                    backendProofContractVersion,
                }
                if (deepLinkTarget !== href) reasons.push(`bad deep-link target for ${id}: ${deepLinkTarget}`)
                if (!ownerLane) reasons.push(`missing owner lane for ${id}`)
                if (!operatorAction) reasons.push(`missing operator action for ${id}`)
                if (blockerCountText === null || Number.isNaN(blockerCount)) reasons.push(`missing blocker count for ${id}`)
                if (!row.getAttribute('data-readiness-priority')) reasons.push(`missing readiness priority for ${id}`)
                if (!proofTimestamp) reasons.push(`missing proof timestamp for ${id}`)
                if (staleAfterSecondsText === null || Number.isNaN(staleAfterSeconds) || staleAfterSeconds <= 0) reasons.push(`missing stale threshold for ${id}`)
                if (expectedDashboardRowId !== id) reasons.push(`bad expected dashboard row id for ${id}: ${expectedDashboardRowId}`)
                if (!integrationProbeHint) reasons.push(`missing integration probe hint for ${id}`)
                if (!backendProofContractVersion) reasons.push(`missing backend proof contract version for ${id}`)
                if (state === 'ready' && blockerCount !== 0) reasons.push(`ready row has blockers: ${id}`)
                if (state !== 'ready' && !unavailableReason) reasons.push(`non-ready row missing reason: ${id}`)
                if (!String(row.getAttribute('class') || '').includes('dark:border-[#2d3a52]')) reasons.push(`missing muted dark border class for ${id}`)
            }
        }

        function visibleRect(element) {
            const style = window.getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null
            if (rect.width <= 0 || rect.height <= 0) return null
            return {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
                text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
            }
        }

        function overlapArea(first, second) {
            const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
            const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
            return width * height
        }

        const rowElements = Array.from(document.querySelectorAll('[data-readiness-row-id], [data-readiness-detail], .source-ops-workbench button, .source-ops-workbench a'))
        const actionElements = Array.from(document.querySelectorAll('[data-readiness-row-id] a, [data-readiness-row-id] button, [data-readiness-detail] a, [data-readiness-detail] button, .source-ops-workbench button, .source-ops-workbench a'))
        const visibleRows = rowElements
            .map((element, index) => ({ element, rect: visibleRect(element), index }))
            .filter(item => item.rect)
        const visibleActions = actionElements
            .map((element, index) => ({ element, rect: visibleRect(element), index }))
            .filter(item => item.rect)
        let overlapCount = 0
        for (let index = 0; index < visibleRows.length; index += 1) {
            for (let next = index + 1; next < visibleRows.length; next += 1) {
                const first = visibleRows[index]
                const second = visibleRows[next]
                if (first.element.contains(second.element) || second.element.contains(first.element)) continue
                if (overlapArea(first.rect, second.rect) > 8) overlapCount += 1
            }
        }

        let narrowActionCount = 0
        for (const { rect } of visibleActions) {
            if (rect.text.length > 6 && rect.width < 56 && rect.height > 40) narrowActionCount += 1
            if (rect.text.length > 10 && rect.height > rect.width * 1.8) narrowActionCount += 1
        }
        if (narrowActionCount) reasons.push(`narrow vertical action controls: ${narrowActionCount}`)

        let clippedTextCount = 0
        for (const element of rowElements) {
            const style = window.getComputedStyle(element)
            if (style.overflow === 'hidden' && element.scrollWidth > element.clientWidth + 2 && (element.textContent || '').trim().length > 12) {
                clippedTextCount += 1
            }
        }
        if (clippedTextCount) reasons.push(`clipped action/readiness text: ${clippedTextCount}`)
        if (overlapCount) reasons.push(`overlapping readiness/action controls: ${overlapCount}`)

        return {
            reasons,
            selectorCounts,
            overlapCount,
            narrowActionCount,
            clippedTextCount,
            bannedCopyList,
            highContrastTokenHits,
            readinessRows,
        }
    }, {
        bannedCopyValues: bannedCopy,
        highContrastValues: highContrastDarkTokens,
        requiredSelectors: spec.requiredSelectors,
        expectedReadinessRows: expectedRows,
    })
}

async function run() {
    const options = parseArgs(process.argv.slice(2))
    await mkdir(options.outDir, { recursive: true })

    const artifact = {
        schema: 'hanasand.dashboard.render-proof.v1',
        generatedAt: new Date().toISOString(),
        baseUrl: options.baseUrl,
        expectedRows,
        pages: [],
        summary: {
            passed: false,
            artifactPath: options.jsonPath,
            screenshotPaths: [],
            failureReasons: [],
            selectorCounts: {},
            overlapCount: 0,
            bannedCopyList: [],
        },
    }

    let browser
    try {
        browser = await chromium.launch({ headless: true })
        for (const spec of pageSpecs) {
            for (const viewport of viewports) {
                const imagePath = screenshotPath(options.outDir, spec.id, viewport.name)
                const result = resultSkeleton(spec, viewport, imagePath)
                artifact.summary.screenshotPaths.push(imagePath)

                const context = await browser.newContext({
                    viewport,
                    colorScheme: 'dark',
                    extraHTTPHeaders: { 'x-hanasand-render-proof-auth': localAuthFixture.header },
                })
                await context.addCookies([
                    { name: 'id', value: encodeURIComponent(localAuthFixture.id), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'name', value: encodeURIComponent(localAuthFixture.name), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'access_token', value: encodeURIComponent(localAuthFixture.token), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'roles', value: encodeURIComponent(JSON.stringify(localAuthFixture.roles)), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    { name: 'email', value: encodeURIComponent('dashboard-render-proof@hanasand.local'), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                ])
                const page = await context.newPage()
                const consoleWarnings = []
                page.on('console', message => {
                    if (!['warning', 'error'].includes(message.type())) return
                    const text = message.text()
                    if (/same key|encountered two children/i.test(text)) consoleWarnings.push(text)
                })
                try {
                    await page.goto(pageUrl(options.baseUrl, spec.path), { waitUntil: 'networkidle', timeout: 45000 })
                    await page.screenshot({ path: imagePath, fullPage: true })
                    const inspected = await inspectRenderedPage(page, spec)
                    Object.assign(result, inspected)
                    result.consoleWarnings = consoleWarnings
                    for (const warning of consoleWarnings) result.reasons.push(`console warning: ${warning}`)
                    result.passed = result.reasons.length === 0
                } catch (error) {
                    result.reasons.push(error instanceof Error ? error.message : String(error))
                } finally {
                    await context.close()
                }

                artifact.pages.push(result)
            }
        }
    } catch (error) {
        artifact.summary.failureReasons.push(error instanceof Error ? error.message : String(error))
    } finally {
        await browser?.close()
    }

    for (const pageResult of artifact.pages) {
        artifact.summary.overlapCount += pageResult.overlapCount
        artifact.summary.bannedCopyList.push(...pageResult.bannedCopyList)
        for (const [selector, count] of Object.entries(pageResult.selectorCounts)) {
            artifact.summary.selectorCounts[`${pageResult.pageId}:${pageResult.viewport.name}:${selector}`] = count
        }
        for (const reason of pageResult.reasons) {
            artifact.summary.failureReasons.push(`${pageResult.pageId}/${pageResult.viewport.name}: ${reason}`)
        }
    }
    artifact.summary.bannedCopyList = Array.from(new Set(artifact.summary.bannedCopyList))
    artifact.summary.passed = artifact.summary.failureReasons.length === 0

    await writeFile(options.jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(artifact, null, 2))
    assert.equal(artifact.summary.passed, true, `Dashboard render proof failed; see ${options.jsonPath}`)
}

void run()
