import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = [
    path.join(frontendRoot, 'src/app'),
    path.join(frontendRoot, 'src/components'),
]

const allowedFiles = new Set([
    'src/app/readiness/page.tsx',
])

const allowedLinePatterns = [
    /src\/app\/api\//,
    /data-[\w-]+state=/,
    /data-[\w-]+-state=/,
    /\bHTTP\b/,
    /response\.status/,
    /upstream\.status/,
    /<HealthBadge\b/,
    /<ChecklistItem\b/,
    /<select\b/,
    /<StatusPill\b[^>]*status=/,
    /\bstatus=\{.*\}/,
    /\bstate=\{.*\}/,
    /function .*StateLabel/,
    /function .*status/i,
    /function label\(/,
    /replaceAll\('_', ' '\)/,
]

const riskyPatterns = [
    { pattern: />\s*(?:blocked|needs_action|action_required|needs action|action required)\s*</i, label: 'dead-end visible state label' },
    { pattern: /label=\{[^}\n]*(?:blocked|needs_action|action_required)[^}\n]*\}/i, label: 'dead-end label prop' },
    { pattern: /value=\{[^}\n]*(?:blocked|needs_action|action_required)[^}\n]*\}/i, label: 'dead-end value prop' },
    { pattern: /\b(?:title|message|detail|body):\s*['`][^'`]*(?:is blocked|are blocked|blocked by|needs action|action required|exact blocker)/i, label: 'dead-end copy literal' },
    { pattern: /\b(?:title|message|detail|body)=['`][^'`]*(?:is blocked|are blocked|blocked by|needs action|action required|exact blocker)/i, label: 'dead-end copy prop' },
    { pattern: /label=\{[^}\n]*\.(?:state|status)\s*\}/, label: 'raw state/status label prop' },
    { pattern: /value=\{[^}\n]*\.(?:state|status)\s*\}/, label: 'raw state/status value prop' },
]

const violations = []

for (const root of roots) {
    for (const file of collectFiles(root)) {
        const relative = path.relative(frontendRoot, file)
        if (allowedFiles.has(relative)) continue
        if (relative.startsWith('src/app/api/')) continue
        if (!file.endsWith('.tsx')) continue
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, index) => {
            if (allowedLinePatterns.some(pattern => pattern.test(line))) return
            for (const { pattern, label } of riskyPatterns) {
                if (pattern.test(line)) {
                    violations.push(`${relative}:${index + 1} ${label}: ${line.trim()}`)
                }
            }
        })
    }
}

if (violations.length) {
    console.error('[visible-state-labels] raw backend state/status can leak into customer UI')
    console.error(violations.join('\n'))
    process.exit(1)
}

console.log('[visible-state-labels] visible state/status labels are normalized')

function collectFiles(root) {
    const files = []
    for (const entry of readdirSync(root)) {
        const absolute = path.join(root, entry)
        const stat = statSync(absolute)
        if (stat.isDirectory()) {
            files.push(...collectFiles(absolute))
            continue
        }
        if (/\.(ts|tsx)$/.test(entry)) files.push(absolute)
    }
    return files.sort((a, b) => a.localeCompare(b))
}
