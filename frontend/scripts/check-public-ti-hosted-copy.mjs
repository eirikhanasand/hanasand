import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Buffer } from 'node:buffer'

const defaultUrl = 'https://hanasand.com/ti/apt29'
const fixtureHtml = process.env.PUBLIC_TI_COPY_PROOF_HTML
const reportOnly = process.env.PUBLIC_TI_COPY_PROOF_REPORT_ONLY === '1'
const urls = (process.env.PUBLIC_TI_COPY_PROOF_URLS || process.env.PUBLIC_TI_COPY_PROOF_URL || defaultUrl)
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)

const targets = fixtureHtml === undefined
    ? await Promise.all(urls.map(fetchTarget))
    : [{ label: process.env.PUBLIC_TI_COPY_PROOF_URL || 'inline-fixture', html: fixtureHtml, status: 200 }]

const results = targets.map(target => proofFor(target))
const failed = results.filter(result => result.returned > 0 || result.whatReturned > 0 || result.returnedProfile > 0 || result.returnedObservations > 0 || result.returnedAsEvidence > 0 || result.returnedAttack > 0)

console.log(JSON.stringify({
    schemaVersion: 'hanasand.public_ti.hosted_copy_proof.v1',
    generatedAt: new Date().toISOString(),
    reportOnly,
    ok: failed.length === 0,
    results,
}, null, 2))

if (failed.length && !reportOnly) {
    throw new Error(`Public TI hosted copy proof failed for ${failed.map(result => result.url).join(', ')}.`)
}

async function fetchTarget(url) {
    const response = await fetchHtml(url)
    if (response.status < 200 || response.status >= 300) throw new Error(`Public TI copy proof could not fetch ${url}: HTTP ${response.status}.`)
    return { label: url, html: response.html, status: response.status }
}

function proofFor(target) {
    const leakedContexts = contextsFor(target.html, /\breturned\b|What returned|returned profile|returned observations|Returned as evidence|returned ATT&CK/gi)

    return {
        url: target.label,
        chars: target.html.length,
        status: target.status,
        whatReturned: count(target.html, /What returned/gi),
        returned: count(target.html, /\breturned\b/gi),
        returnedProfile: count(target.html, /returned profile/gi),
        returnedObservations: count(target.html, /returned observations/gi),
        returnedAsEvidence: count(target.html, /Returned as evidence/gi),
        returnedAttack: count(target.html, /returned ATT&CK/gi),
        leakedContexts,
    }
}

function count(value, pattern) {
    return Array.from(value.matchAll(pattern)).length
}

function contextsFor(value, pattern) {
    const contexts = []
    for (const match of value.matchAll(pattern)) {
        const index = match.index ?? 0
        const start = Math.max(0, index - 90)
        const end = Math.min(value.length, index + 130)
        contexts.push(value.slice(start, end).replace(/\s+/g, ' ').trim())
        if (contexts.length >= 8) break
    }
    return contexts
}

function fetchHtml(rawUrl, redirects = 3) {
    return new Promise((resolve, reject) => {
        const url = new URL(rawUrl)
        const client = url.protocol === 'http:' ? httpRequest : httpsRequest
        const request = client(url, {
            headers: {
                accept: 'text/html,application/xhtml+xml',
                'user-agent': 'hanasand-public-ti-copy-proof/1.0',
            },
        }, response => {
            const status = response.statusCode ?? 0
            const location = response.headers.location
            if (location && status >= 300 && status < 400 && redirects > 0) {
                response.resume()
                const nextUrl = new URL(location, url).toString()
                fetchHtml(nextUrl, redirects - 1).then(resolve, reject)
                return
            }

            const chunks = []
            response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
            response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), status }))
        })
        request.on('error', reject)
        request.end()
    })
}
