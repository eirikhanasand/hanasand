import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inventory, sha256 } from '../scripts/code-inventory.mjs'

test('routes, aliases, queries and transitive review hashes follow source changes', () => {
    const files = new Map([
        ['frontend/src/app/page.tsx', 'import View from \'@/components/view\'; export default View'],
        ['frontend/src/app/layout.tsx', 'export default function Layout() { return null }'],
        ['frontend/src/components/view.tsx', 'export default function View() { return fetch(\'/api/things\') }'],
        ['frontend/src/app/api/things/route.ts', 'export async function GET() { return fetch(`${config.url.api}/things`) }'],
        ['api/src/routes.ts', 'import handler from \'./handlers/things\'; fastify.get(\'/things\', handler)'],
        ['api/src/handlers/things.ts', 'import run from \'#db\'; export default () => run(\'SELECT id FROM things\', [])'],
        ['api/src/utils/db.ts', 'export default function run(sql) { return sql }'],
        ['app/Main.swift', 'struct Main {}'],
        ['db/init.sql', 'CREATE TABLE things (id INT);'],
    ])
    const first = inventory(files), byId = new Map(first.nodes.map(node => [node.id, node]))
    const page = byId.get('frontend:frontend/src/app/page.tsx')
    assert.equal(page.sha256, sha256(files.get(page.file)))
    assert.ok(page.dependencyCount >= 7)
    assert.ok(first.nodes.some(node => node.kind === 'database' && node.file === 'api/src/handlers/things.ts'))
    assert.ok(first.nodes.some(node => node.kind === 'api' && node.title === 'GET /api/things'))
    assert.ok(byId.get('source:app/Main.swift').unresolved.length)
    files.set('api/src/handlers/things.ts', files.get('api/src/handlers/things.ts').replace('SELECT id', 'SELECT id, name'))
    const after = new Map(inventory(files).nodes.map(node => [node.id, node]))
    assert.equal(after.get(page.id).sha256, page.sha256)
    assert.notEqual(after.get(page.id).reviewHash, page.reviewHash)
    assert.equal(after.get('source:app/Main.swift').reviewHash, byId.get('source:app/Main.swift').reviewHash)
})
test('cyclic modules terminate and dynamic references remain visible', () => {
    const result = inventory(new Map([
        ['frontend/src/a.ts', 'import \'./b\'; import(target); fetch(dynamicUrl)'],
        ['frontend/src/b.ts', 'import \'./a\''],
    ]))
    assert.equal(result.nodes.length, 2)
    assert.equal(result.nodes[0].dependencyCount, 1)
    assert.ok(result.nodes[0].unresolved.some(value => value.includes('Dynamic import')))
    assert.ok(result.nodes[0].unresolved.some(value => value.includes('dynamicUrl')))
})
