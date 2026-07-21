import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const [route, client, sidebar] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/app/api/ti/claims/[[...path]]/route.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/claimReviewClient.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8'),
])

assert.match(route, /requireApiSession\(request, \['owner', 'system_admin', 'admin', 'administrator', 'analyst'\]\)/)
assert.match(route, /new URL\(listing \? '\/v1\/intel\/claims' : `\/v1\/intel\/claims\/\$\{encodeURIComponent\(segments\[0\]\)\}\/reviews`/)
assert.match(route, /'x-tenant-id': 'default'/)
assert.match(route, /cache: 'no-store'/)
assert.match(route, /query\.length > 200/)
assert.match(route, /Number\(limit\) > 100/)
assert.match(client, /'confirm' \| 'reject' \| 'mark_needs_review' \| 'mark_contradicted'/)
assert.match(client, /reason\.trim\(\)\.length < 8/)
assert.match(sidebar, /href: '\/dashboard\/ti\/review'/)
