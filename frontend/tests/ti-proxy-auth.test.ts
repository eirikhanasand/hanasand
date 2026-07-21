import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const [proxy, product, session] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/app/api/dwm/_tiProxy.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/api/dwm/product/route.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/utils/proxy/requireApiSession.ts'), 'utf8'),
])

assert.match(proxy, /await requireApiSession\(request\)/)
assert.match(proxy, /const actorId = id/)
assert.doesNotMatch(proxy, /x-user-email/)
assert.doesNotMatch(proxy, /x-tenant-id': request\.headers\.get\('x-tenant-id'\) \|\| 'default'/)
assert.match(product, /await requireApiSession\(request\)/)
assert.match(product, /authorization: `Bearer \$\{identity\.token\}`/)
assert.match(session, /await tokenIsValid\(token, id\)/)
assert.match(session, /'cache-control': 'no-store'/)
assert.match(proxy, /A valid API key or Hanasand session is required\./)
