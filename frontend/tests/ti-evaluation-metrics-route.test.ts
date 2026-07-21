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
assert.match(client, /independenceAttested/)
assert.match(client, /Brier/)
for (const label of ['actor', 'ransomware', 'victim', 'cve', 'malware', 'ttp', 'country', 'sector', 'impact', 'dataset']) {
    assert.match(client, new RegExp(`['"]${label}['"]`))
}
