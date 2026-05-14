import assert from 'node:assert/strict'

const baseUrl = (process.env.PUBLIC_ARCHIVE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

const htmlRoutes = [
    '/eirik',
    '/eirik/motivation',
    '/articles/readme',
    '/articles/theme',
]

for (const route of htmlRoutes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' })
    assert.equal(response.status, 200, `${route} should return 200`)
    assert.match(response.headers.get('content-type') || '', /text\/html/, `${route} should return HTML`)
}

const notes = await fetch(`${baseUrl}/notes`, { redirect: 'manual' })
assert.equal(notes.status, 307, '/notes should redirect to the private dashboard notes app')
assert.equal(notes.headers.get('location'), '/dashboard/notes', '/notes should redirect to /dashboard/notes')

const robots = await text('/robots.txt')
assert.match(robots, /Sitemap:\s*https:\/\/hanasand\.com\/sitemap\.xml/, 'robots.txt should advertise the sitemap')
assert.match(robots, /Disallow:\s*\/notes/, 'robots.txt should keep private notes out of crawlers')
assert.match(robots, /Disallow:\s*\/dashboard\//, 'robots.txt should keep dashboard paths out of crawlers')

const sitemap = await text('/sitemap.xml')
for (const route of [
    '/eirik',
    '/eirik/motivation',
    '/articles/bot',
    '/articles/cache',
    '/articles/event',
    '/articles/lsm',
    '/articles/readme',
    '/articles/theme',
]) {
    assert.match(sitemap, new RegExp(`<loc>https://hanasand\\.com${escapeRegExp(route)}</loc>`), `sitemap should include ${route}`)
}

console.log(`Public archive smoke passed for ${baseUrl}.`)

async function text(route) {
    const response = await fetch(`${baseUrl}${route}`)
    assert.equal(response.status, 200, `${route} should return 200`)
    return response.text()
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
