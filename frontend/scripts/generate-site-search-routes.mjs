import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const appDir = path.join(frontendDir, 'src/app')
const outputPath = path.join(frontendDir, 'src/utils/routes/generatedSearchRoutes.ts')

async function pageRoutes(directory, segments = []) {
    const entries = await readdir(directory, { withFileTypes: true })
    const routes = []

    if (entries.some(entry => entry.isFile() && /^page\.(tsx|jsx|ts|js)$/.test(entry.name))
        && !segments.some(segment => segment.startsWith('[') && segment.endsWith(']'))) {
        routes.push('/' + segments.join('/'))
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@')) continue
        const nextSegments = entry.name.startsWith('(') && entry.name.endsWith(')') ? segments : [...segments, entry.name]
        routes.push(...await pageRoutes(path.join(directory, entry.name), nextSegments))
    }

    return routes
}

function labelFor(route) {
    if (route === '/') return 'Home'
    return route.split('/').filter(Boolean).map(segment => segment
        .replace(/[-_]/g, ' ')
        .replace(/\b[a-z]/g, character => character.toUpperCase())
    ).join(' · ')
}

const routes = [...new Set(await pageRoutes(appDir))].sort((a, b) => a.localeCompare(b))
const items = routes.map(href => JSON.stringify({
    id: `route:${href}`,
    title: labelFor(href),
    detail: href === '/' ? 'Overview and product entry point' : `Page · ${href}`,
    href,
}))
const content = `// Generated from static App Router page files by scripts/generate-site-search-routes.mjs.\nexport const generatedSearchRoutes = [\n    ${items.join(',\n    ')}\n] as const\n`

await writeFile(outputPath, content)
