import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const testPage = readSource('src/app/test/page.tsx')
const testClient = readSource('src/app/test/pageClient.tsx')
const loadTestingPage = readSource('src/app/dashboard/load-testing/page.tsx')
const loadTestingClient = readSource('src/app/dashboard/load-testing/pageClient.tsx')
const tiClient = readSource('src/app/ti/pageClient.tsx')

assertIncludes(testClient, 'Check a service before users do', 'public service check page must lead with the primary workflow')
assertIncludes(testClient, 'Run an owned HTTP endpoint through a measured scenario with latency, failure-rate, logs, and a shareable evidence report.', 'public service check page must explain the concrete evidence produced')
assertIncludes(testClient, 'grid h-full min-h-0 w-full min-w-0 grid-rows-[minmax(21rem,auto)_minmax(0,1fr)]', 'public service check layout must reserve the main row for the centered launcher')
assertIncludes(testClient, 'place-items-center', 'public service check launcher must be centered')
assertIncludes(testClient, 'const scenarioPresets = [', 'public service check page must expose scenario presets')
assertIncludes(testClient, 'id: \'baseline\'', 'public service check page must include a baseline preset')
assertIncludes(testClient, 'id: \'ramp\'', 'public service check page must include a ramp preset')
assertIncludes(testClient, 'id: \'spike\'', 'public service check page must include a spike preset')
assertIncludes(testClient, 'postTest({ url: path, timeout: selectedScenario.timeout, stages: selectedScenario.stages })', 'public service check launcher must send scenario timeout and stages to the job API')
assertIncludes(testClient, 'RecentScans title=\'My service checks\'', 'public service check page must show personal result history')
assertIncludes(testClient, 'RecentScans title=\'Service-wide checks\'', 'public service check page must show shared result history')
assertExcludes(testClient, 'Service check launcher', 'public service check page must not use the old small-column launcher copy')
assertExcludes(testClient, 'lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)_minmax(12rem,16rem)]', 'public service check page must not regress to the narrow side-column layout')

assertIncludes(testPage, 'min-h-[calc(100vh-4.5rem)]', 'public service check page shell must allow the redesigned workflow to scroll')
assertExcludes(testPage, 'h-[calc(100vh-4.5rem)] overflow-hidden', 'public service check shell must not clip the redesigned workflow')

assertIncludes(loadTestingPage, 'title=\'Load testing and endpoint evidence\'', 'dashboard service check route must present evidence-oriented operations copy')
assertIncludes(loadTestingPage, '<LoadTestingOperations />', 'dashboard service check route must render the operations command center before secondary tables')
assertOrder(loadTestingPage, '<LoadTestingOperations />', '<DashboardPanel className=\'overflow-hidden p-0\'>', 'dashboard operations command center must appear before allowance lanes')

assertIncludes(loadTestingClient, 'Run a service check with evidence you can act on', 'dashboard command center must lead with the service-check workflow')
assertIncludes(loadTestingClient, 'fetchRecentTests', 'dashboard command center must read actual recent check history')
assertIncludes(loadTestingClient, 'latestP95(latest)', 'dashboard command center must derive latency evidence from recent run data')
assertIncludes(loadTestingClient, 'failedScans.length ? String(failedScans.length) : \'Clear\'', 'dashboard command center must derive failure state from recent run data')
assertIncludes(loadTestingClient, 'postTest({ url: targetUrl, timeout: selectedScenario.timeout, stages: selectedScenario.stages })', 'dashboard command center must send scenario timeout and stages to the job API')
assertIncludes(loadTestingClient, 'value=\'p95/p99 evidence\'', 'dashboard command center must surface latency evidence, not a vague launch promise')
assertIncludes(loadTestingClient, 'value=\'logs + share link\'', 'dashboard command center must surface artifact evidence')
assertExcludes(loadTestingClient, 'Next: run more jobs', 'dashboard command center must not ship next-action placeholder copy')
assertExcludes(loadTestingClient, 'needs proof', 'dashboard command center must not ship blocker-style placeholder copy')
assertExcludes(loadTestingClient, 'needs work', 'dashboard command center must not ship blocker-style placeholder copy')

const emptyState = extractFunction(tiClient, 'function EmptyState()')
const searchFormStart = tiClient.indexOf('<form onSubmit={submit}')
const resultsGate = tiClient.indexOf('{visible ? <Results')
assert.ok(searchFormStart >= 0, 'TI page search form was not found')
assert.ok(resultsGate > searchFormStart, 'TI page result visibility gate was not found after the search form')
const landingForm = tiClient.slice(searchFormStart, resultsGate)

assertIncludes(landingForm, 'Search threat intelligence', 'TI landing must use a concise search-focused heading')
assertIncludes(landingForm, 'Find current intelligence about any threat actor, company, domain, CVE, or malware family.', 'TI landing must use one short blue helper line')
assertIncludes(tiClient, 'max-w-4xl place-content-center gap-5 py-10', 'TI landing must center the search workflow before a result exists')
assertIncludes(emptyState, 'APT29', 'TI empty state may keep compact query chips')
assertIncludes(emptyState, 'LockBit', 'TI empty state may keep compact query chips')
assertIncludes(emptyState, 'microsoft.com', 'TI empty state may keep compact query chips')
assertExcludes(emptyState, 'Threat intelligence workspace', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Investigation view', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Handoff status', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Source coverage', 'TI empty state must not restore the old text-heavy workspace copy')

console.log('[service-check-ti-landing] service check and TI landing UX guard passed')

function readSource(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(source, needle, message) {
    assert.ok(source.includes(needle), `${message}: missing ${JSON.stringify(needle)}`)
}

function assertExcludes(source, needle, message) {
    assert.equal(source.includes(needle), false, `${message}: found ${JSON.stringify(needle)}`)
}

function assertOrder(source, first, second, message) {
    const firstIndex = source.indexOf(first)
    const secondIndex = source.indexOf(second)
    assert.ok(firstIndex >= 0, `${message}: missing first token ${JSON.stringify(first)}`)
    assert.ok(secondIndex >= 0, `${message}: missing second token ${JSON.stringify(second)}`)
    assert.ok(firstIndex < secondIndex, `${message}: expected ${JSON.stringify(first)} before ${JSON.stringify(second)}`)
}

function extractFunction(source, signature) {
    const start = source.indexOf(signature)
    assert.ok(start >= 0, `Could not find ${signature}`)
    let depth = 0
    let seenBody = false

    for (let index = start; index < source.length; index += 1) {
        const char = source[index]
        if (char === '{') {
            depth += 1
            seenBody = true
        } else if (char === '}') {
            depth -= 1
            if (seenBody && depth === 0) {
                return source.slice(start, index + 1)
            }
        }
    }

    throw new Error(`Could not extract ${signature}`)
}
