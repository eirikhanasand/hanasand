import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const expectedRows = {
    dashboard_evidence: '/dashboard',
    source_inventory_probe: '/dashboard/ti/sources',
    end_to_end_workflow: '/dashboard/ti/sources',
    dwm_product_snapshot: '/dashboard/dwm',
    entitlement_readiness: '/dashboard/dwm',
    webhook_delivery: '/dashboard/automations?setup=dwm',
    org_alert_export: '/dashboard/dwm',
    webhook_health: '/dashboard/automations?setup=dwm',
    organization_webhook_settings: '/organizations',
    helpdesk_audit: '/dashboard/system/impersonation',
    deploy_probe: '/status',
    public_ti_provenance: '/ti',
}

const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
]

const colorSchemes = ['dark', 'light']

const pageSpecs = [
    {
        id: 'dashboard',
        path: '/dashboard',
        requiredSelectors: ['[data-readiness-row-id]', '[data-readiness-owner-lane]', '[data-readiness-operator-action]', '[data-readiness-workflow-blocker]', '[data-readiness-customer-impact]', '[data-readiness-source-reference]', '[data-readiness-action-count]', '[data-readiness-backend-contract-version]', '[data-readiness-priority]', '[data-readiness-detail]', '[data-readiness-detail-actions]', '[data-readiness-scorecard-link="/readiness"]'],
    },
    {
        id: 'dashboard_ti_control',
        path: '/dashboard/ti/control',
        requiredSelectors: ['.source-ops-workbench', 'button'],
    },
    {
        id: 'public_ti',
        path: '/ti',
        requiredSelectors: ['main'],
        allowedBannedCopy: ['apt29', 'lockbit'],
    },
    {
        id: 'public_ti_apt29',
        path: '/ti/apt29',
        requiredSelectors: ['main', '[data-ti-command-bar]'],
        allowedBannedCopy: ['apt29'],
    },
    {
        id: 'pwned',
        path: '/pwned',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_workbench',
        path: '/dashboard/ti/workbench',
        requiredSelectors: ['main', '[role="listbox"][aria-label="Analyst case list"]'],
    },
    {
        id: 'cron_jobs',
        path: '/dashboard/system/cron',
        requiredSelectors: ['main', 'button'],
    },
    {
        id: 'vulnerabilities',
        path: '/dashboard/vulnerabilities',
        requiredSelectors: ['main'],
    },
    {
        id: 'readiness',
        path: '/readiness',
        requiredSelectors: ['main', '[data-north-star-readiness-ledger]'],
    },
    {
        id: 'traffic',
        path: '/dashboard/traffic',
        requiredSelectors: ['main'],
    },
    {
        id: 'system',
        path: '/dashboard/system',
        requiredSelectors: ['main'],
    },
    {
        id: 'database',
        path: '/dashboard/db',
        requiredSelectors: ['main'],
    },
    {
        id: 'logs',
        path: '/dashboard/logs',
        requiredSelectors: ['main'],
    },
    {
        id: 'automations',
        path: '/dashboard/automations',
        requiredSelectors: ['main'],
    },
    {
        id: 'organizations',
        path: '/organizations',
        requiredSelectors: ['main', '#destinations', '#watchlists', '#audit'],
    },
    {
        id: 'subscription',
        path: '/dashboard/subscription',
        requiredSelectors: ['main'],
    },
    {
        id: 'notes',
        path: '/dashboard/notes',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_activity',
        path: '/dashboard/ti/activity',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_audit',
        path: '/dashboard/ti/audit',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_enrichment',
        path: '/dashboard/ti/enrichment',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_sources',
        path: '/dashboard/ti/sources',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_runs',
        path: '/dashboard/ti/runs',
        requiredSelectors: ['main'],
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
    'dashboard handoff',
    'backed handoff',
    'apt29',
    'lockbit',
]

const deadEndCopyPatterns = [
    { label: 'blocked', pattern: '\\bblocked\\b', allowedNearby: ['recapture', 'retry'] },
    { label: 'needs action', pattern: '\\bneeds action\\b' },
    { label: 'action required', pattern: '\\baction required\\b' },
    { label: 'needs work', pattern: '\\bneeds work\\b' },
    { label: 'needs proof', pattern: '\\bneeds proof\\b' },
    { label: 'will appear here after', pattern: 'will appear here after' },
    { label: 'ai parser output', pattern: 'ai parser output' },
    { label: 'source provenance', pattern: 'source provenance' },
    { label: 'evidence-backed', pattern: 'evidence-backed' },
    { label: 'source-backed', pattern: 'source-backed' },
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
        pageIds: [],
    }
    for (const arg of argv) {
        if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length).replace(/\/$/, '')
        if (arg.startsWith('--out-dir=')) options.outDir = arg.slice('--out-dir='.length)
        if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length)
        if (arg.startsWith('--page=')) options.pageIds = arg.slice('--page='.length).split(',').map(value => value.trim()).filter(Boolean)
        if (arg === '--help') {
            console.log('Usage: node scripts/check-dashboard-render-dom.mjs --base-url=http://127.0.0.1:3010 --out-dir=/tmp [--page=traffic,logs]')
            process.exit(0)
        }
    }
    options.jsonPath ||= path.join(options.outDir, 'hanasand-dashboard-render-proof.json')
    return options
}

function screenshotPath(outDir, pageId, viewportName, colorScheme) {
    return path.join(outDir, `hanasand-${pageId}-${viewportName}-${colorScheme}.png`)
}

function pageUrl(baseUrl, pagePath) {
    return `${baseUrl}${pagePath}`
}

function cookieUrl(baseUrl) {
    return new URL(baseUrl).origin
}

async function gotoWithRetry(page, url, options, attempts = 3) {
    let lastError
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await page.goto(url, options)
        } catch (error) {
            lastError = error
            const message = error instanceof Error ? error.message : String(error)
            if (!/ERR_EMPTY_RESPONSE|ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message) || attempt === attempts) {
                throw error
            }
            await page.waitForTimeout(700 * attempt)
        }
    }
    throw lastError
}

function resultSkeleton(spec, viewport, colorScheme, imagePath) {
    return {
        pageId: spec.id,
        path: spec.path,
        viewport,
        colorScheme,
        screenshotPath: imagePath,
        passed: false,
        reasons: [],
        selectorCounts: {},
        overlapCount: 0,
        narrowActionCount: 0,
        clippedTextCount: 0,
        bannedCopyList: [],
        highContrastTokenHits: [],
        contrastIssues: [],
        consoleWarnings: [],
        readinessRows: {},
    }
}

async function inspectRenderedPage(page, spec) {
    return page.evaluate(({ bannedCopyValues, deadEndPatterns, highContrastValues, requiredSelectors, expectedReadinessRows }) => {
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
        for (const { label, pattern, allowedNearby = [] } of deadEndPatterns) {
            const regex = new RegExp(pattern, 'i')
            if (!regex.test(bodyText)) continue
            const isAllowed = allowedNearby.some(value => bodyText.includes(value))
            if (!isAllowed) reasons.push(`visible dead-end state copy: ${label}`)
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

        const contrastIssues = collectContrastIssues()
        for (const issue of contrastIssues) {
            reasons.push(`low contrast ${issue.ratio.toFixed(2)}: ${issue.text} (${issue.selector})`)
        }

        const readinessRows = {}
        if (location.pathname === '/dashboard') {
            const isMobileViewport = window.innerWidth < 640
            const mobileSidebar = document.querySelector('.dashboard-sidebar-sticky')
            const mobileSidebarRect = mobileSidebar ? visibleRect(mobileSidebar) : null
            if (isMobileViewport && mobileSidebarRect) {
                reasons.push('mobile dashboard renders expanded navigation before the workbench')
            }
            const detail = document.querySelector('[data-readiness-detail]')
            if (!detail) {
                reasons.push('missing readiness detail panel')
            } else {
                for (const attr of ['data-readiness-detail-owner', 'data-readiness-detail-action', 'data-readiness-detail-workflow-blocker', 'data-readiness-detail-customer-impact', 'data-readiness-detail-source-reference', 'data-readiness-detail-contract', 'data-readiness-detail-href']) {
                    if (!detail.getAttribute(attr)) reasons.push(`readiness detail missing ${attr}`)
                }
                if (detail.getAttribute('data-readiness-detail-state') !== 'ready' && !detail.getAttribute('data-readiness-detail-blocker')) {
                    reasons.push('readiness detail missing blocker')
                }
                const detailActionCount = Number(detail.getAttribute('data-readiness-detail-action-count'))
                if (!detailActionCount || Number.isNaN(detailActionCount)) reasons.push('readiness detail missing backed actions')
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
                const workflowBlocker = row.getAttribute('data-readiness-workflow-blocker') || ''
                const customerImpact = row.getAttribute('data-readiness-customer-impact') || ''
                const evidenceProvenance = row.getAttribute('data-readiness-source-reference') || row.getAttribute('data-readiness-provenance') || ''
                const actionCountText = row.getAttribute('data-readiness-action-count')
                const actionCount = Number(actionCountText)
                const unavailableReason = row.getAttribute('data-readiness-unavailable-reason') || ''
                const proofTimestamp = row.getAttribute('data-readiness-checked-at') || row.getAttribute('data-readiness-proof-timestamp') || ''
                const staleAfterSecondsText = row.getAttribute('data-readiness-stale-after-seconds')
                const staleAfterSeconds = Number(staleAfterSecondsText)
                const expectedDashboardRowId = row.getAttribute('data-readiness-expected-dashboard-row-id') || ''
                const integrationProbeHint = row.getAttribute('data-readiness-integration-probe-hint') || ''
                const backendProofContractVersion = row.getAttribute('data-readiness-backend-contract-version') || row.getAttribute('data-readiness-backend-proof-contract-version') || ''
                readinessRows[id] = {
                    present: true,
                    state,
                    blockerCount,
                    deepLinkTarget,
                    ownerLane,
                    operatorAction,
                    workflowBlocker,
                    customerImpact,
                    evidenceProvenance,
                    actionCount,
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
                if (!workflowBlocker) reasons.push(`missing workflow blocker for ${id}`)
                if (!customerImpact) reasons.push(`missing customer impact for ${id}`)
                if (!evidenceProvenance) reasons.push(`missing evidence provenance for ${id}`)
                if (actionCountText === null || Number.isNaN(actionCount) || actionCount <= 0) reasons.push(`missing backed actions for ${id}`)
                if (blockerCountText === null || Number.isNaN(blockerCount)) reasons.push(`missing blocker count for ${id}`)
                if (!row.getAttribute('data-readiness-priority')) reasons.push(`missing readiness priority for ${id}`)
                if (!proofTimestamp) reasons.push(`missing proof timestamp for ${id}`)
                if (staleAfterSecondsText === null || Number.isNaN(staleAfterSeconds) || staleAfterSeconds <= 0) reasons.push(`missing stale threshold for ${id}`)
                if (expectedDashboardRowId !== id) reasons.push(`bad expected dashboard row id for ${id}: ${expectedDashboardRowId}`)
                if (!integrationProbeHint) reasons.push(`missing integration probe hint for ${id}`)
                if (!backendProofContractVersion) reasons.push(`missing backend proof contract version for ${id}`)
                if (state === 'ready' && blockerCount !== 0) reasons.push(`ready row has blockers: ${id}`)
                if (['blocked', 'needs_action', 'unavailable'].includes(state)) reasons.push(`customer-facing dead-end readiness state for ${id}: ${state}`)
                if (state !== 'ready' && !unavailableReason) reasons.push(`non-ready row missing reason: ${id}`)
                if (!String(row.getAttribute('class') || '').includes('border-[#27364f]')) reasons.push(`missing muted dark border class for ${id}`)
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

        function parseRgb(value) {
            const match = value.match(/rgba?\(([^)]+)\)/)
            if (!match) return null
            const [r, g, b, a = '1'] = match[1].split(',').map(part => Number(part.trim()))
            if ([r, g, b, a].some(channel => Number.isNaN(channel))) return null
            return { r, g, b, a }
        }

        function mixColors(foreground, background) {
            const alpha = foreground.a ?? 1
            return {
                r: foreground.r * alpha + background.r * (1 - alpha),
                g: foreground.g * alpha + background.g * (1 - alpha),
                b: foreground.b * alpha + background.b * (1 - alpha),
                a: 1,
            }
        }

        function luminance(color) {
            const channels = [color.r, color.g, color.b].map(channel => {
                const normalized = channel / 255
                return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        }

        function contrastRatio(first, second) {
            const lighter = Math.max(luminance(first), luminance(second))
            const darker = Math.min(luminance(first), luminance(second))
            return (lighter + 0.05) / (darker + 0.05)
        }

        function effectiveBackground(element) {
            let current = element
            while (current && current !== document.documentElement) {
                const background = parseRgb(window.getComputedStyle(current).backgroundColor)
                if (background && (background.a ?? 1) > 0.05) {
                    if ((background.a ?? 1) >= 0.98) return background
                    const parent = current.parentElement ? effectiveBackground(current.parentElement) : parseRgb(window.getComputedStyle(document.body).backgroundColor)
                    return parent ? mixColors(background, parent) : background
                }
                current = current.parentElement
            }
            return parseRgb(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
        }

        function elementSelector(element) {
            if (element.id) return `#${element.id}`
            const attr = ['data-readiness-row-id', 'data-ti-command-bar', 'aria-label']
                .map(name => element.getAttribute(name) ? `[${name}="${element.getAttribute(name)}"]` : '')
                .find(Boolean)
            if (attr) return attr
            const className = String(element.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
            return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`
        }

        function isLeafTextElement(element) {
            const text = (element.textContent || '').replace(/\s+/g, ' ').trim()
            if (!text || text.length > 90) return false
            if (element.querySelector('button, a, input, textarea, select')) return false
            const childText = Array.from(element.children).map(child => (child.textContent || '').replace(/\s+/g, ' ').trim()).join(' ').trim()
            return childText.length < text.length
        }

        function shouldSampleContrast(element, style) {
            if (!isLeafTextElement(element)) return false
            if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.45) return false
            const rect = element.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight + 1200) return false
            const className = String(element.getAttribute('class') || '')
            const role = element.getAttribute('role') || ''
            if (element.closest('button, a, [role="button"], [role="option"], [role="tab"], [role="listitem"]')) return true
            if (/rounded|badge|pill|chip|tag|status|bg-\[|bg-|border-\[/.test(className)) return true
            if (/button|option|tab|status/.test(role)) return true
            return false
        }

        function collectContrastIssues() {
            const issues = []
            for (const element of Array.from(document.querySelectorAll('body *'))) {
                const style = window.getComputedStyle(element)
                if (!shouldSampleContrast(element, style)) continue
                const foreground = parseRgb(style.color)
                const background = effectiveBackground(element)
                if (!foreground || !background) continue
                const ratio = contrastRatio(foreground, background)
                const fontSize = Number.parseFloat(style.fontSize)
                const fontWeight = Number.parseInt(style.fontWeight, 10)
                const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 600)
                const threshold = largeText ? 3 : 4.5
                if (ratio >= threshold) continue
                issues.push({
                    ratio,
                    threshold,
                    text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
                    selector: elementSelector(element),
                })
                if (issues.length >= 12) break
            }
            return issues
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
            contrastIssues,
            readinessRows,
        }
    }, {
        bannedCopyValues: bannedCopy.filter(value => !(spec.allowedBannedCopy || []).includes(value)),
        deadEndPatterns: deadEndCopyPatterns,
        highContrastValues: highContrastDarkTokens,
        requiredSelectors: spec.requiredSelectors,
        expectedReadinessRows: expectedRows,
    })
}

async function run() {
    const options = parseArgs(process.argv.slice(2))
    await mkdir(options.outDir, { recursive: true })
    const selectedPageSpecs = options.pageIds.length
        ? pageSpecs.filter(spec => options.pageIds.includes(spec.id))
        : pageSpecs
    const unknownPageIds = options.pageIds.filter(pageId => !pageSpecs.some(spec => spec.id === pageId))
    assert.equal(unknownPageIds.length, 0, `Unknown page ids: ${unknownPageIds.join(', ')}`)

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
        for (const spec of selectedPageSpecs) {
            for (const colorScheme of colorSchemes) {
                for (const viewport of viewports) {
                    console.error(`[render-proof] ${spec.id} ${colorScheme} ${viewport.name}`)
                    const imagePath = screenshotPath(options.outDir, spec.id, viewport.name, colorScheme)
                    const result = resultSkeleton(spec, viewport, colorScheme, imagePath)
                    artifact.summary.screenshotPaths.push(imagePath)

                    const context = await browser.newContext({
                        viewport,
                        colorScheme,
                        extraHTTPHeaders: { 'x-hanasand-render-proof-auth': localAuthFixture.header },
                    })
                    await context.addCookies([
                        { name: 'id', value: encodeURIComponent(localAuthFixture.id), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                        { name: 'name', value: encodeURIComponent(localAuthFixture.name), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                        { name: 'access_token', value: encodeURIComponent(localAuthFixture.token), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                        { name: 'roles', value: encodeURIComponent(JSON.stringify(localAuthFixture.roles)), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                        { name: 'email', value: encodeURIComponent('dashboard-render-proof@hanasand.local'), url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                        { name: 'theme', value: colorScheme, url: cookieUrl(options.baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' },
                    ])
                    await context.addInitScript((scheme) => {
                        document.documentElement.classList.toggle('dark', scheme === 'dark')
                        document.documentElement.classList.toggle('light', scheme === 'light')
                        window.localStorage.setItem('theme', scheme)
                    }, colorScheme)
                    const page = await context.newPage()
                    const consoleWarnings = []
                    page.on('console', message => {
                        if (!['warning', 'error'].includes(message.type())) return
                        const text = message.text()
                        if (/same key|encountered two children/i.test(text)) consoleWarnings.push(text)
                    })
                    try {
                        await gotoWithRetry(page, pageUrl(options.baseUrl, spec.path), { waitUntil: 'domcontentloaded', timeout: 45000 })
                        for (const selector of spec.requiredSelectors) {
                            await page.locator(selector).first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {})
                        }
                        await page.waitForTimeout(250)
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
            artifact.summary.selectorCounts[`${pageResult.pageId}:${pageResult.colorScheme}:${pageResult.viewport.name}:${selector}`] = count
        }
        for (const reason of pageResult.reasons) {
            artifact.summary.failureReasons.push(`${pageResult.pageId}/${pageResult.colorScheme}/${pageResult.viewport.name}: ${reason}`)
        }
    }
    artifact.summary.bannedCopyList = Array.from(new Set(artifact.summary.bannedCopyList))
    artifact.summary.passed = artifact.summary.failureReasons.length === 0

    await writeFile(options.jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(artifact, null, 2))
    assert.equal(artifact.summary.passed, true, `Dashboard render proof failed; see ${options.jsonPath}`)
}

void run()
