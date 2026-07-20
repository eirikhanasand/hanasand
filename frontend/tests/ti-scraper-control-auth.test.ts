import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const source = await readFile(path.join(process.cwd(), 'src/app/api/ti/scraper/control/route.ts'), 'utf8')

assert.match(source, /requireApiSession\(request, \['system_admin', 'admin', 'administrator'\]\)/)
assert.match(source, /system_admin/)
assert.match(source, /authorization: `Bearer \$\{identity\.token\}`/)
