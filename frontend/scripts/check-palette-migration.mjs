import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(frontendRoot, 'src')
const files = collectTsFiles(srcRoot)

const hardcodedPattern = /\b(?:bg|text|border|ring|outline|shadow|from|to|via|placeholder|decoration|accent)-\[#|\b(?:bg|text|border|ring|outline|shadow)-(?:white|black|bright|dark)\//g
const uiTokenPattern = /\b(?:bg|text|border|ring|outline)-ui-/g

const rows = files
    .map(file => {
        const source = readFileSync(file, 'utf8')
        return {
            file: path.relative(srcRoot, file),
            hardcoded: source.match(hardcodedPattern)?.length ?? 0,
            uiTokens: source.match(uiTokenPattern)?.length ?? 0,
        }
    })
    .filter(row => row.hardcoded || row.uiTokens)
    .sort((a, b) => b.hardcoded - a.hardcoded || b.uiTokens - a.uiTokens || a.file.localeCompare(b.file))

const hardcodedTotal = rows.reduce((sum, row) => sum + row.hardcoded, 0)
const uiTokenTotal = rows.reduce((sum, row) => sum + row.uiTokens, 0)

console.log(`[palette-migration] files=${files.length} withColor=${rows.length} hardcoded=${hardcodedTotal} uiTokens=${uiTokenTotal}`)
for (const row of rows.slice(0, 30)) {
    console.log(`${String(row.hardcoded).padStart(4)} hardcoded ${String(row.uiTokens).padStart(3)} ui ${row.file}`)
}

function collectTsFiles(root) {
    const out = []
    for (const entry of readdirSync(root)) {
        const absolute = path.join(root, entry)
        const stat = statSync(absolute)
        if (stat.isDirectory()) {
            out.push(...collectTsFiles(absolute))
            continue
        }
        if (/\.(ts|tsx)$/.test(entry)) out.push(absolute)
    }
    return out.sort((a, b) => a.localeCompare(b))
}
