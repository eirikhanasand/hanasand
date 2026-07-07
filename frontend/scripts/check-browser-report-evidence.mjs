import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const liveClient = readSource('src/app/solutions/browser/pageClient.tsx')
const reportClient = readSource('src/app/solutions/browser/report/pageClient.tsx')

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

console.log('[browser-report-evidence] browser report evidence contract passed')

function readSource(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(source, needle, message) {
    assert.ok(source.includes(needle), `${message}: missing ${JSON.stringify(needle)}`)
}
