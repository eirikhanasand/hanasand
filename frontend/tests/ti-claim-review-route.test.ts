import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const [route, client, automaticQueue, workspace, sidebar] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/app/api/ti/claims/[[...path]]/route.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/claimReviewClient.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/automaticReviewQueue.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/reviewWorkspace.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8'),
])

assert.match(route, /requireApiSession\(request, \['owner', 'system_admin', 'admin', 'administrator', 'analyst'\]\)/)
assert.match(route, /automaticListing/)
assert.match(route, /'\/v1\/intel\/automatic-reviews'/)
assert.match(route, /`\/v1\/intel\/automatic-reviews\/\$\{encodeURIComponent\(segments\[1\]\)\}\/replay`/)
assert.match(route, /'x-tenant-id': 'default'/)
assert.match(route, /cache: 'no-store'/)
assert.match(route, /query\.length > 200/)
assert.match(route, /automaticListing \? 250 : 100/)
assert.match(client, /'confirm' \| 'reject' \| 'mark_needs_review' \| 'mark_contradicted'/)
assert.match(client, /reason\.trim\(\)\.length < 8/)
assert.match(workspace, /AutomaticReviewQueue/)
assert.match(automaticQueue, /\/api\/ti\/claims\/automatic-reviews/)
assert.match(automaticQueue, /Queue eligible/)
assert.match(automaticQueue, /Run next batch/)
assert.match(automaticQueue, /Persisted decision history/)
assert.match(automaticQueue, /Governed evidence sent to Hanasand AI/)
assert.match(automaticQueue, /\['dead_letter', 'quarantined'\]/)
assert.match(sidebar, /href: '\/dashboard\/ti\/review'/)
