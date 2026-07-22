import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const [route, client] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/app/api/ti/evaluation/route.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/evaluation/evaluationBenchmarkClient.tsx'), 'utf8'),
])

assert.match(route, /requireApiSession\(request, \['system_admin', 'admin', 'administrator', 'analyst'\]\)/)
assert.match(route, /new URL\('\/v1\/intel\/evaluation', base\)/)
assert.match(route, /datasetSplit !== 'validation' && datasetSplit !== 'test'/)
assert.match(client, /automatic: true/)
assert.match(client, /\/run\?scope=/)
assert.match(client, /\/retry\?scope=/)
assert.match(client, /Brier/)
assert.match(client, /Specificity/)
assert.match(client, /confidenceIntervals/)
assert.match(client, /Drift history/)
for (const label of ['actor', 'ransomware', 'victim', 'incident', 'cve', 'malware', 'ttp', 'country', 'sector', 'indicator', 'impact', 'dataset', 'business_mechanism']) {
    assert.match(client, new RegExp(`['"]${label}['"]`))
}
