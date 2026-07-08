import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const liveClient = readSource('src/app/solutions/browser/pageClient.tsx')
const reportClient = readSource('src/app/solutions/browser/report/pageClient.tsx')
const backendProxy = readSource('src/app/api/backend/[...path]/route.ts')

for (const token of [
    'function buildExportReport',
    'function buildShareableAnalystReport',
    'providerReports',
    'networkEvidence',
    'finalUrl',
    'redirectChain',
    'urlStates',
    'peerSummary',
    'downloads',
    'scriptArtifacts',
    'resourceUrls',
    'threatAssociations',
    'recommendedActions',
    'markdown',
]) {
    assertIncludes(liveClient, token, `browser export must preserve ${token}`)
}

assertIncludes(liveClient, 'networkPeerSummary(latestNetwork)', 'browser export must derive DNS/IP/certificate peer evidence')
assertIncludes(liveClient, '## Network', 'markdown export must include network evidence')
assertIncludes(liveClient, '## Script artifacts', 'markdown export must include script evidence')
assertIncludes(liveClient, '## Indicators', 'markdown export must include copyable indicators')
assertIncludes(liveClient, 'Run evidence summary', 'live browser workspace must summarize analyst evidence before raw drilldown')
assertIncludes(liveClient, 'Final URL', 'live browser workspace must expose final URL')
assertIncludes(liveClient, 'DNS / IP / certificate peers', 'live browser workspace must expose peer/certificate evidence')
assertIncludes(liveClient, 'Hashed downloads', 'live browser workspace must expose download hash evidence')
assertIncludes(liveClient, 'Script hashes', 'live browser workspace must expose script hash evidence')
assertIncludes(liveClient, 'Copyable indicators', 'live browser workspace must expose IOC count')
assertIncludes(liveClient, 'aspect-[16/9] w-full', 'live browser viewport must stay full-width 16:9')
assertIncludes(liveClient, 'No sample needed', 'WebCrack no-sample runs must not look unavailable')
assertIncludes(liveClient, 'consoleEvents', 'page console output must be separated from broker activity')
assertIncludes(liveClient, 'title=\'Activity\'', 'broker status messages must render as activity, not console logs')
assertIncludes(liveClient, 'virusTotalVendorLabel', 'VirusTotal labels must avoid broken 0/? totals')
assertIncludes(liveClient, 'ANALYSIS_TOOL_DOMAINS', 'copyable indicators must exclude analysis provider URLs')

for (const token of [
    'Browser sandbox report',
    'Analyst summary',
    'URL timeline',
    'Providers',
    'Screenshot timeline',
    'Network evidence',
    'DNS / IP / certificate evidence',
    'Script artifacts',
    'Resource URLs',
    'Markdown export',
    'Threat context',
    'Indicators',
]) {
    assertIncludes(reportClient, token, `saved browser report must render ${token}`)
}

assertIncludes(reportClient, 'networkPeer(request)', 'network table must expose peer/certificate details')
assertIncludes(reportClient, 'download.sha256', 'saved browser report must expose download hashes')
assertIncludes(backendProxy, 'anonymousAllowed', 'browser run reports must be saveable without console auth')
assertIncludes(backendProxy, 'browser', 'anonymous backend proxy exception must stay scoped to browser routes')
assertIncludes(backendProxy, 'runs', 'anonymous backend proxy exception must stay scoped to browser runs')

console.log('[browser-report-evidence] browser report evidence contract passed')

function readSource(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(source, needle, message) {
    assert.ok(source.includes(needle), `${message}: missing ${JSON.stringify(needle)}`)
}
