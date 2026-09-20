import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { collectProviderResponses, firstUrlQueryReportUrl, parseVirusTotalStats, parseUrlQueryScores, providerStartUrl, waitForProviderData } from '../src/handlers/onionSession/ws.ts'

const live = process.argv.includes('--live')
const target = 'https://vg.no/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined })
try {
    const context = await browser.newContext()
    const reportUrl = 'https://urlquery.net/report/5778a6a3-889c-4d6e-a415-ddc13c4911a0'
    if (!live) {
        await context.route('https://urlquery.net/**', route => route.fulfill({ contentType: 'text/html', body: route.request().url() === reportUrl
            ? '<body>Report Overview<br>Visited<br>public<br>2026-09-15 07:19:14<br>URL<br>vg.no<br>Finishing URL<br>www.vg.no/<br>Detections<br>urlquery<br>0<br>Network Intrusion Detection<br>0<br>Threat Detection Systems<br>0<br>Related reports<br>9 - 9 - 9</body>'
            : `<table><tr><td>vg.no mentioned here</td><td><a href="/report/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">evil.test</a></td></tr><tr><td>UQ 0 IDS 0 TDS 0</td><td><a href="${reportUrl}">vg.no</a></td></tr></table>` }))
        await context.route('https://www.virustotal.com/**', async route => {
            const url = new URL(route.request().url())
            if (url.pathname.startsWith('/gui/')) {
                await route.fulfill({ contentType: 'text/html', body: `<body><p>VirusTotal</p><script>
                    (async () => {
                        await fetch('/ui/urls/test');
                        for (let i=0;i<12;i++) await fetch('/ui/urls/test/last_serving_ip_address');
                        document.body.dataset.finished='true';
                    })();
                </script></body>` })
                return
            }
            const related = url.pathname.includes('last_serving_ip_address')
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { type: related ? 'ip_address' : 'url', attributes: {
                url: target, padding: 'x'.repeat(90_000), last_analysis_date: 1_789_000_000,
                last_analysis_stats: { malicious: related ? 22 : 2, suspicious: 1, harmless: 80, undetected: 12, timeout: 0 },
            } } }) })
        })
    }
    for (const name of ['urlquery', 'VirusTotal']) {
        const page = await context.newPage()
        const tool = { name }
        const start = providerStartUrl(tool, name === 'urlquery' ? 'https://urlquery.net/search' : 'https://www.virustotal.com/gui/home/search', target)
        const bodies = collectProviderResponses(page, name, target)
        await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 25_000 })
        if (name === 'urlquery' && !live) assert.equal(await firstUrlQueryReportUrl(page, target), reportUrl)
        if (name === 'VirusTotal' && !live) await page.waitForFunction(() => document.body.dataset.finished === 'true')
        const result = await waitForProviderData(tool, page, bodies.text, target)
        if (name === 'urlquery') {
            assert.match(page.url(), /\/report\//)
            assert.deepEqual(parseUrlQueryScores(result), { alerts: 0 })
            assert.match(result, /Existing urlquery report: 2026-/)
        } else {
            const score = parseVirusTotalStats(result)
            assert(score && score.total > 0, result)
            if (!live) assert.deepEqual(score, { flagged: 3, total: 95 }, 'related-IP scores must not replace URL results')
            assert.match(result, /Existing VirusTotal analysis:/)
        }
        console.log(JSON.stringify({ mode: live ? 'live' : 'fixture', provider: name, source: page.url(), result }))
        await page.close()
    }
    if (!live) {
        for (const [status, reason] of [[404, /no existing analysis/], [429, /rate-limited/], [403, /denied access/]] as const) {
            await context.route('https://www.virustotal.com/ui/urls/test', route => route.fulfill({ status, contentType: 'application/json', body: '{}' }))
            const page = await context.newPage()
            const bodies = collectProviderResponses(page, 'VirusTotal', target)
            await page.goto('https://www.virustotal.com/gui/url/test')
            await page.waitForFunction(() => document.body.dataset.finished === 'true')
            const result = await waitForProviderData({ name: 'VirusTotal' }, page, bodies.text, target)
            assert.match(result, reason)
            assert.equal(parseVirusTotalStats(result), null)
            await page.close()
        }
        await Promise.all([
            'URL vg.no Finishing URL www.vg.no/ Related reports 0 - 0 - 0 No alerts detected',
            'URL evil.test Finishing URL evil.test/ Detections urlquery 0 Network Intrusion Detection 0 Threat Detection Systems 0 Contacted domains: vg.no',
        ].map(async body => {
            const isolated = await browser.newContext()
            try {
                await isolated.route(reportUrl, route => route.fulfill({ contentType: 'text/html', body }))
                const page = await isolated.newPage()
                await page.goto(reportUrl)
                const result = await waitForProviderData({ name: 'urlquery' }, page, () => '', target)
                assert.match(result, /No verified report returned/)
                assert.equal(parseUrlQueryScores(result), null, 'missing or wrong-target detector summary stays unknown')
            } finally { await isolated.close() }
        }))
        console.log('Missing reports, rate limits, denied access, and misleading related reports remain unknown.')
    }
} finally {
    await browser.close()
}
