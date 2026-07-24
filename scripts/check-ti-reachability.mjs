import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

function filesUnder(directory) {
    if (!existsSync(directory)) return []
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name)
        if (entry.name === 'node_modules' || entry.name === '.next') return []
        return entry.isDirectory() ? filesUnder(path) : extensions.some(extension => path.endsWith(extension)) ? [normalize(path)] : []
    })
}

function importsOf(path) {
    const source = readFileSync(path, 'utf8')
    const values = []
    for (const pattern of [
        /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g,
        /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    ]) {
        for (const match of source.matchAll(pattern)) values.push(match[1])
    }
    return values
}

function resolveImport(from, request, service) {
    let target
    if (request.startsWith('.')) target = resolve(dirname(from), request)
    else if (service === 'frontend' && request.startsWith('@/')) target = resolve(root, 'frontend/src', request.slice(2))
    else if (service === 'scraper' && request.startsWith('#/')) target = resolve(root, 'ti/scraper/src', request.slice(2))
    else if (service === 'api' && request.startsWith('#/')) target = resolve(root, 'api/src', request.slice(2))
    else if (service === 'api' && request === '#db') target = resolve(root, 'api/src/utils/db')
    else if (service === 'api' && request.startsWith('#utils/')) target = resolve(root, 'api/src/utils', request.slice(7))
    else if (service === 'api' && request.startsWith('#plugins/')) target = resolve(root, 'api/src/plugins', request.slice(9))
    else if (service === 'api' && request.startsWith('#components/')) target = resolve(root, 'api/src/components', request.slice(12))
    else return
    return [
        target,
        ...extensions.map(extension => `${target}${extension}`),
        ...extensions.map(extension => join(target, `index${extension}`)),
    ].find(candidate => existsSync(candidate) && statSync(candidate).isFile())
}

function reachable(roots, service) {
    const seen = new Set()
    const pending = [...roots]
    while (pending.length) {
        const path = pending.pop()
        if (!path || seen.has(path) || !existsSync(path)) continue
        seen.add(path)
        for (const request of importsOf(path)) {
            const target = resolveImport(path, request, service)
            if (target && !seen.has(target)) pending.push(target)
        }
    }
    return seen
}

const rel = path => relative(root, path)

function inventory(name, serviceRoot, productionRoots, operationalRoots, testRoots, inScope) {
    const sourceFiles = filesUnder(resolve(root, serviceRoot))
    const production = reachable(productionRoots.map(path => resolve(root, path)), name)
    const operational = reachable(operationalRoots.map(path => resolve(root, path)), name)
    const tests = reachable(testRoots.flatMap(path => filesUnder(resolve(root, path))), name)
    const scoped = sourceFiles.filter(inScope)
    return {
        service: name,
        scopedModules: scoped.length,
        productionReachable: scoped.filter(path => production.has(path)).length,
        operationalOnly: scoped.filter(path => !production.has(path) && operational.has(path)).map(rel).sort(),
        testOnly: scoped.filter(path => !production.has(path) && !operational.has(path) && tests.has(path)).map(rel).sort(),
        orphan: scoped.filter(path => !production.has(path) && !operational.has(path) && !tests.has(path)).map(rel).sort(),
    }
}

const frontendRoot = resolve(root, 'frontend/src/app')
const frontendRoutes = filesUnder(frontendRoot).filter(path => /\/(?:page|route|layout|loading|error|not-found)\.(?:ts|tsx)$/.test(path))
const operationalRoots = directory => filesUnder(resolve(root, directory)).map(rel)
const inventories = [
    inventory('frontend', 'frontend/src', frontendRoutes.map(rel), [], ['frontend/tests'], path =>
        /frontend\/src\/(?:app\/(?:ti|dashboard\/ti|api\/ti)\/|utils\/ti\/)/.test(path)),
    inventory('api', 'api/src', ['api/src/index.ts'], operationalRoots('api/scripts'), ['api/tests'], path =>
        /api\/src\/(?:handlers\/ti\/|.*(?:dwm|Dwm|TI|Ti).*\.(?:ts|tsx)$)/.test(path)),
    inventory('scraper', 'ti/scraper/src', ['ti/scraper/src/index.ts'], operationalRoots('ti/scraper/scripts'), ['ti/scraper/src/tests'], path =>
        !/\/tests\//.test(path)),
]

const migrationFiles = readdirSync(resolve(root, 'ti/scraper/migrations')).filter(name => name.endsWith('.sql')).sort()
const storeSource = readFileSync(resolve(root, 'ti/scraper/src/storage/postgresScraperStore.ts'), 'utf8')
const registeredMigrations = [...storeSource.matchAll(/migrations\/([^"']+\.sql)/g)].map(match => match[1]).sort()
const migrationMismatch = migrationFiles.filter(name => !registeredMigrations.includes(name))
    .concat(registeredMigrations.filter(name => !migrationFiles.includes(name)))

const evaluationFiles = [
    'ti/scraper/src/api/evaluationBenchmarkRoutes.ts',
    'ti/scraper/src/pipeline/evaluationMetrics.ts',
]
const untypedEvaluation = evaluationFiles.flatMap(path => {
    const source = readFileSync(resolve(root, path), 'utf8')
    return /@ts-nocheck|\bas any\b|:\s*any\b|<any>/.test(source) ? [path] : []
})
const obsoleteFiles = [
    'ti/scraper/src/pipeline/evaluation.ts',
    'ti/scraper/src/pipeline/darkwebIndexFixtures.ts',
    'frontend/src/app/solutions/browser',
].filter(path => existsSync(resolve(root, path)))
const startupPath = resolve(root, 'ti/scraper/src/runtime/startup.ts')
const scheduledModules = importsOf(startupPath)
    .map(request => resolveImport(startupPath, request, 'scraper'))
    .filter(Boolean)
    .map(rel)
    .filter(path => /\/(?:ops|api)\//.test(path))
    .sort()

const output = {
    canonicalBrowserRoute: existsSync(resolve(root, 'frontend/src/app/browser/page.tsx')),
    obsoleteFiles,
    untypedEvaluation,
    frontendRoutes: frontendRoutes.filter(path => /\/(?:ti|dashboard\/ti|api\/ti)\//.test(path)).map(rel).sort(),
    scraperStartupModules: scheduledModules,
    migrations: { files: migrationFiles.length, registered: registeredMigrations.length, mismatch: migrationMismatch },
    inventories,
}

console.log(JSON.stringify(output, null, 2))
if (!output.canonicalBrowserRoute || obsoleteFiles.length || untypedEvaluation.length || migrationMismatch.length || inventories.some(item => item.orphan.length)) process.exit(1)
