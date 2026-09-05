import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Follow re-exports as Next does: a canonical route must end in a view,
// while each legacy route may redirect once to that canonical route.
async function pageSource(path, seen = new Set()) {
    assert(!seen.has(path), `Circular page export: ${path}`)
    seen.add(path)
    const source = await readFile(new URL(path), 'utf8')
    const target = source.match(/export \{ default \} from ['"]([^'"]+)['"]/)?.[1]
    return target ? pageSource(new URL(`${target}.tsx`, path).href, seen) : source
}

for (const [route, view] of [['monitoring', 'AutomationsClient'], ['cron', 'CronJobsClient'], ['health', 'AutomationsClient']]) {
    const canonical = new URL(`../src/app/dashboard/automation/${route}/page.tsx`, import.meta.url)
    const source = await pageSource(canonical.href)
    assert(source.includes(`<${view}`), `${route} must render ${view}, not a redirect`)
    const legacy = route === 'health' ? 'health-checks' : route
    const redirect = await readFile(new URL(`../src/app/dashboard/automations/${legacy}/page.tsx`, import.meta.url), 'utf8')
    assert(redirect.includes(`redirect('/dashboard/automation/${route}')`))
}
console.log('Automation routes render their views; legacy redirects remain one-way.')
