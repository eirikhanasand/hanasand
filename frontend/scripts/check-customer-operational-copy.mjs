import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(frontendRoot, '..')

const roots = [
    'frontend/src',
    'api/src',
    'ti/scraper/src',
]

const bannedRenderedCopy = [
    { pattern: /\bAll loaded claims are visible\b/i, label: 'stiff loaded-claims ending' },
    { pattern: /\bWhat was claimed\b/i, label: 'claim-centric table label', frontendOnly: true },
    { pattern: /\bclaimed-data\b/i, label: 'claim-centric data wording', frontendOnly: true },
    { pattern: /\bclaimed data\b/i, label: 'claim-centric data wording', frontendOnly: true },
    { pattern: /\bvictim claims?\b/i, label: 'claim-centric incident wording', frontendOnly: true },
    { pattern: /\bvictim-claim\b/i, label: 'claim-centric incident wording', frontendOnly: true },
    { pattern: /\bactor claims?\b/i, label: 'claim-centric actor wording', frontendOnly: true },
    { pattern: /\bmatched claims?\b/i, label: 'claim-centric match wording', frontendOnly: true },
    { pattern: /\bclaim changes\b/i, label: 'claim-centric change wording', frontendOnly: true },
    { pattern: /\balert-ready\b/i, label: 'internal readiness wording', frontendOnly: true },
    { pattern: /\bexposure queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bentity queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\boperations queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bwork the queue\b/i, label: 'internal queue instruction', frontendOnly: true },
    { pattern: /\bwork queue is clear\b/i, label: 'internal queue empty-state', frontendOnly: true },
    { pattern: /\banalyst work queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bqueue and links\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\breview queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\b(?:Activity|Alert|Case|Evidence|Source health|Staged handoff|Webhook delivery) queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bStart queue\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bQueue enrichment\b/i, label: 'internal queue naming', frontendOnly: true },
    { pattern: /\bSource operations\b/i, label: 'internal operations naming', frontendOnly: true },
    { pattern: /\bActor enrichment\b/i, label: 'internal enrichment naming', frontendOnly: true },
    { pattern: /\bDedupe key\b/i, label: 'engineering dedupe naming', frontendOnly: true },
    { pattern: /\bOpen DWM workspace\b/i, label: 'acronym workspace naming', frontendOnly: true },
    { pattern: /\bqueue item\b/i, label: 'internal queue item naming', frontendOnly: true },
    { pattern: /\bpersisted queue work\b/i, label: 'internal queue work naming', frontendOnly: true },
    { pattern: /\bactor-page\b/i, label: 'internal source-family naming', frontendOnly: true },
    { pattern: /\bactor pages?\b/i, label: 'internal source-family naming', frontendOnly: true },
    { pattern: /\bCollector cadence\b/i, label: 'scheduler jargon' },
    { pattern: /\bcontrol plane\b/i, label: 'platform jargon' },
    { pattern: /\broute truth\b/i, label: 'internal validation jargon' },
    { pattern: /\breadiness proof\b/i, label: 'internal proof wording' },
    { pattern: /\bcustomer workflow proof\b/i, label: 'internal proof wording' },
    { pattern: /\bbackend proof\b/i, label: 'internal proof wording' },
    { pattern: /\bUI proof\b/i, label: 'internal proof wording' },
    { pattern: /\bProof source-backed monitoring\b/i, label: 'landing-page proof/source bloat' },
    { pattern: /\bsource-backed\b/i, label: 'source-backed bloat' },
    { pattern: /\bevidence-backed\b/i, label: 'evidence-backed bloat' },
    { pattern: /\bproof source\b/i, label: 'proof/source bloat' },
    { pattern: /\bdeploy proof\b/i, label: 'internal proof wording' },
    { pattern: /\balert proof\b/i, label: 'internal proof wording' },
    { pattern: /\bgeneration proof\b/i, label: 'internal proof wording' },
    { pattern: /\bworker proof\b/i, label: 'internal proof wording' },
    { pattern: /\bproof ledger\b/i, label: 'internal proof wording' },
    { pattern: /\bexport proof\b/i, label: 'internal proof wording' },
    { pattern: /\blive proof\b/i, label: 'internal proof wording' },
    { pattern: /\bcase proof\b/i, label: 'internal proof wording' },
    { pattern: /\bgrounded (?:answer|claim|context|intelligence)\b/i, label: 'grounded bloat' },
    { pattern: /\bsource provenance\b/i, label: 'provenance bloat', frontendOnly: true },
    { pattern: /\bprovenance (?:row|rows|ref|refs|reference|references|ready|needed|attached|url)\b/i, label: 'provenance bloat', frontendOnly: true },
    { pattern: /\bwith provenance\b/i, label: 'provenance bloat', frontendOnly: true },
    { pattern: /\bsource\/provenance\b/i, label: 'provenance bloat', frontendOnly: true },
    { pattern: /\bstructured provenance\b/i, label: 'provenance bloat', frontendOnly: true },
    { pattern: /\breadiness contracts?\b/i, label: 'contract jargon' },
    { pattern: /\bAI parser output\b/i, label: 'parser implementation detail' },
    { pattern: /\bGlobal API pressure\b/i, label: 'vague system metric' },
    { pattern: /\bnow live in the same surface\b/i, label: 'vague surface wording' },
    { pattern: /\btuned independently\b/i, label: 'vague tuning wording' },
    { pattern: /\bwill appear here after\b/i, label: 'stiff empty-state wording' },
    { pattern: /\bsource attaching\b/i, label: 'process jargon' },
    { pattern: /\bstatus attaching\b/i, label: 'process jargon' },
    { pattern: /\brequest attaching\b/i, label: 'process jargon' },
    { pattern: /\bLog stream quiet\b/i, label: 'quiet-state jargon' },
    { pattern: /\bQuery watcher quiet\b/i, label: 'quiet-state jargon' },
    { pattern: /\bHealthy quiet\b/i, label: 'quiet-state jargon' },
    { pattern: /\bsnapshot poll\b/i, label: 'polling implementation detail' },
    { pattern: /\bloaded but not active\b/i, label: 'loaded-state jargon' },
    { pattern: /\bneeds action\b/i, label: 'dead-end action wording' },
    { pattern: /\baction required\b/i, label: 'dead-end action wording' },
    { pattern: /\bneeds proof\b/i, label: 'dead-end proof wording' },
    { pattern: /\bneeds work\b/i, label: 'dead-end work wording' },
    { pattern: /\bblocked until\b/i, label: 'dead-end blocked wording' },
    { pattern: /\bdelivery blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: /\breplay blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: /\bcase replay blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: /\bcase handoff blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: /\breplay export blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: /\bkeep blocked\b/i, label: 'dead-end blocked wording' },
    { pattern: />\s*blocked\s*</i, label: 'dead-end blocked wording' },
    { pattern: /['"`]Blocked['"`]/, label: 'dead-end blocked wording' },
]

const bannedPublicTiRenderedCopy = [
    { pattern: /\b(?:Artifact|artifact)\b/, label: 'public TI artifact jargon' },
    { pattern: /\b(?:Handoff|handoff)\b/, label: 'public TI handoff jargon' },
    { pattern: /\b(?:Enrichment|enrichment)\b/, label: 'public TI enrichment jargon' },
    { pattern: /\b(?:TTP|TTPs)\b/, label: 'public TI TTP jargon' },
    { pattern: /\bExposure\b/, label: 'public TI exposure jargon' },
    { pattern: /\b(?:row|rows)\b/, label: 'public TI database-row wording' },
    { pattern: /\b(?:workbench|drilldown)\b/i, label: 'public TI internal workspace wording' },
]

const bannedPublicTiAttributes = [
    { pattern: /\btitle='(?:Collection Worklist|Collection Gaps|Enrichment triage|Handoff status)'/, label: 'public TI internal panel title' },
    { pattern: /\blabel='(?:Enrichment request|Enrichment triage|Handoff status|Selected artifact|Copy artifact|Open artifact)'/, label: 'public TI internal button label' },
]

const runtimeFiles = []
let totalLineCount = 0
const violations = []
const scannedRoots = []
const skippedRoots = []

for (const root of roots) {
    const absoluteRoot = path.join(workspaceRoot, root)
    if (!existsSync(absoluteRoot)) {
        skippedRoots.push(root)
        continue
    }
    scannedRoots.push(root)
    runtimeFiles.push(...collectTsFiles(absoluteRoot))
}

for (const file of runtimeFiles) {
    const source = readFileSync(file, 'utf8')
    const lines = source.split(/\r?\n/)
    totalLineCount += lines.length
    const relativeFile = path.relative(workspaceRoot, file)
    const isTestFile = /(^|\/)(tests?|__tests__)\//.test(relativeFile) || /\.(test|spec)\.tsx?$/.test(relativeFile)

    for (const [index, line] of lines.entries()) {
        if (isTestFile) continue
        for (const { pattern, label, frontendOnly } of bannedRenderedCopy) {
            if (frontendOnly && !relativeFile.startsWith('frontend/src/')) continue
            if (pattern.test(line)) {
                violations.push(`${relativeFile}:${index + 1} ${label}: ${line.trim()}`)
            }
        }
        if (relativeFile === 'frontend/src/app/ti/pageClient.tsx') {
            for (const { pattern, label } of bannedPublicTiAttributes) {
                if (pattern.test(line)) {
                    violations.push(`${relativeFile}:${index + 1} ${label}: ${line.trim()}`)
                }
            }
            for (const text of renderedTextNodes(line)) {
                for (const { pattern, label } of bannedPublicTiRenderedCopy) {
                    if (pattern.test(text)) {
                        violations.push(`${relativeFile}:${index + 1} ${label}: ${text.trim()}`)
                    }
                }
            }
        }
    }
}

if (violations.length) {
    console.error('[customer-operational-copy] customer/API copy guard failed')
    console.error(violations.join('\n'))
    process.exit(1)
}

console.log(`[customer-operational-copy] passed: searched ${runtimeFiles.length} TS/TSX files and ${totalLineCount} lines across ${scannedRoots.join(', ')}${skippedRoots.length ? `; skipped unavailable roots ${skippedRoots.join(', ')}` : ''}`)

function renderedTextNodes(line) {
    return [...line.matchAll(/>([^<{]+)</g)].map(match => match[1]).filter(text => text.trim() && !text.includes('>'))
}

function collectTsFiles(root) {
    const files = []
    for (const entry of readdirSync(root)) {
        const absolute = path.join(root, entry)
        const stat = statSync(absolute)
        if (stat.isDirectory()) {
            files.push(...collectTsFiles(absolute))
            continue
        }
        if (/\.(ts|tsx)$/.test(entry)) files.push(absolute)
    }
    return files.sort((a, b) => a.localeCompare(b))
}
