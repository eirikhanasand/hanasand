import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

for (const [route, view] of [['', 'AutomationsClient'], ['monitoring/', 'AutomationsClient'], ['health/', 'AutomationsClient'], ['cron/', 'CronJobsClient']]) {
    const source = await readFile(new URL(`../src/app/dashboard/automation/${route}page.tsx`, import.meta.url), 'utf8')
    assert(source.includes(`<${view}`), `${route} must render ${view} directly`)
    assert(!source.includes('export { default } from'), `${route} must not re-export another page`)
    assert(!source.includes('../automations/'), `${route} must not import a legacy route`)
}
for (const path of ['automations/page.tsx', 'automations/monitoring/page.tsx', 'automations/cron/page.tsx', 'automations/health-checks/page.tsx', 'system/cron/page.tsx', 'cron-jobs/page.tsx', 'automation/health-checks/page.tsx']) {
    await assert.rejects(access(new URL(`../src/app/dashboard/${path}`, import.meta.url)), { code: 'ENOENT' })
}
const systemFallback = await readFile(new URL('../src/app/dashboard/system/[...id]/page.tsx', import.meta.url), 'utf8')
assert.match(systemFallback, /if \(params.id\[0\] === 'cron'\) notFound\(\)/, 'Removed Cron route must not fall through to a VM redirect')
console.log('Current automation routes render directly; legacy pages are removed.')
