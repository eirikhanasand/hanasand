import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ws = readFileSync(new URL('../src/handlers/onionSession/ws.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../frontend/src/app/solutions/browser/pageClient.tsx', import.meta.url), 'utf8')

assert.match(ws, /const cleanup = async \(runStatus: 'ended' \| 'failed' = 'ended'\)/, 'cleanup should accept the terminal run status')
assert.match(ws, /await cleanup\('failed'\)/, 'launch failures should persist browser_runs.status=failed')
assert(ws.includes('const kind = officialProviderKind(resolvedUrl)'), 'provider start URLs should be based on configured provider hosts')
assert.doesNotMatch(ws, /\|\| \(isVirusTotalTool\(tool, resolvedUrl\) \? 'virustotal' : ''\)/, 'tool labels should not rewrite custom VirusTotal fixtures to the public provider')
assert.doesNotMatch(ws, /\|\| \(isUrlQueryTool\(tool, resolvedUrl\) \? 'urlquery' : ''\)/, 'tool labels should not rewrite custom urlquery fixtures to the public provider')
assert.match(page, /statusState === 'failed'/, 'frontend should treat backend failed status as a failed run')
assert.match(page, /setRunBlocker\(String\(payload\.message \|\| 'Sandbox launch failed\.'\)\)/, 'frontend should surface the backend launch failure message')

for (const value of [
    'selectToolCapture(toolCaptures, tool, target)',
    'selectToolCapture(toolCaptures, tool, input.target)',
    'selectToolCapture(toolCaptures, activeTool, normalizedTarget)',
]) {
    assert(page.includes(value), `provider capture selection should be target-scoped: ${value}`)
}

assert(!page.includes('selectToolCapture(toolCaptures, tool)'))

console.log('Browser failed-state and provider-target contract passed.')
