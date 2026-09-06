import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const sha256 = value => createHash('sha256').update(value).digest('hex')
const sourceExtensions = /\.(?:[cm]?[jt]sx?|py|swift|sql|sh|bash|zsh|c|cc|cpp|cxx|h|hpp|cu|cuh|cl|comp|glsl|vert|frag|rs|go|java|kt|rb|php|vue|svelte|css|scss|html|cmake|make|mk|jinja|json|ya?ml|toml|nix|wgsl|gbnf|in|metal|m|mm|tmpl|conf|vcl|plist|tcl|s|idl|pc|ini|bat|ps1|service|timer|xml|proto|graphql|prisma)$/i
const excluded = /(?:^|\/)(?:node_modules|CMakeFiles|\.git|\.next|\.build|build|dist|target|coverage|vendor-cache|\.artifacts|\.venv|venv|__pycache__)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|.*(?:credentials|secrets).*\.(?:json|ya?ml|toml)|package-lock\.json|bun\.lock|.*lock\.json)$/i
export function collectSources(root) {
    const files = new Map()
    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name), relative = path.relative(root, absolute).split(path.sep).join('/')
            if (excluded.test(relative) || entry.isSymbolicLink()) continue
            if (entry.isDirectory()) walk(absolute)
            else if (sourceExtensions.test(relative) || /(?:^|\/)(?:Dockerfile(?:\.[^/]+)?|[^/]+\.Dockerfile|Makefile|CMakeLists\.txt)$/.test(relative)) {
                const data = fs.readFileSync(absolute)
                if (!data.includes(0)) files.set(relative, data.toString('utf8'))
            }
        }
    }
    walk(root)
    return files
}
export function inventory(files) {
    const nodes = new Map(), asts = new Map(), imports = new Map(), fetches = [], routeNodes = []
    const fileId = file => `source:${file}`
    const add = item => { nodes.set(item.id, { ...item, sha256: sha256(item.content), dependencies: [], unresolved: [], ...item }); return nodes.get(item.id) }
    const edge = (item, target) => { if (target && target !== item.id && !item.dependencies.includes(target)) item.dependencies.push(target) }
    function resolve(file, specifier) {
        const base = file.startsWith('frontend/') ? 'frontend/' : file.startsWith('api/') ? 'api/' : file.split('/').slice(0, -1).join('/') + '/'
        const aliases = base === 'frontend/' ? { '@/': 'src/', '@utils/': 'src/utils/', '@components/': 'src/components/', '@styles/': 'src/styles/', 'uibee/': 'src/uibee/', '@parent/': '' } : { '#utils/': 'src/utils/', '#plugins/': 'src/plugins/', '#components/': 'src/components/', '#/': 'src/', '#db': 'src/utils/db.ts', '#constants': 'src/constants.ts', '#ws': 'src/plugins/ws.ts' }
        let candidate = specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null
        for (const [alias, replacement] of Object.entries(aliases)) if (specifier.startsWith(alias)) candidate = base + replacement + specifier.slice(alias.length)
        if (!candidate) return null
        for (const attempt of [candidate, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js'].map(ext => candidate + ext), candidate.replace(/\.js$/, '.ts')]) if (files.has(attempt)) return fileId(attempt)
        return null
    }
    for (const [file, content] of files) {
        const item = add({ id: fileId(file), kind: 'source', title: file, file, content })
        if (!/\.[cm]?[jt]sx?$/.test(file)) {
            const references = [...content.matchAll(/^\s*#\s*include\s*["<]([^">]+)[">]|@import\s+['"]([^'"]+)['"]|^\s*from\s+([.\w]+)\s+import/gm)]
            for (const match of references) {
                const specifier = match[1] || match[2] || match[3].replace(/\./g, '/')
                const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
                let target = [relative, relative + '.py', relative + '/__init__.py'].find(candidate => files.has(candidate))
                if (!target) {
                    const candidates = [...files.keys()].filter(candidate => candidate.startsWith(file.split('/')[0] + '/') && candidate.endsWith('/' + specifier))
                    if (candidates.length === 1) target = candidates[0]
                }
                if (target) edge(item, fileId(target))
                else item.unresolved.push(`External or unresolved reference: ${specifier}`)
            }
            item.unresolved.push('Additional dependencies in this language require manual inspection.')
            continue
        }
        const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
        asts.set(file, ast)
        const bindings = new Map(); imports.set(file, bindings)
        function walk(node) {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                const specifier = node.moduleSpecifier.text, target = resolve(file, specifier)
                if (target) edge(item, target)
                else if (/^[.#@]/.test(specifier)) item.unresolved.push(`Unresolved import: ${specifier}`)
                if (ts.isImportDeclaration(node) && target) {
                    if (node.importClause?.name) bindings.set(node.importClause.name.text, target)
                    const names = node.importClause?.namedBindings
                    if (names && ts.isNamedImports(names)) for (const name of names.elements) bindings.set(name.name.text, target)
                    if (names && ts.isNamespaceImport(names)) bindings.set(names.name.text, target)
                }
            }
            if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require')) {
                const argument = node.arguments[0]
                if (argument && ts.isStringLiteralLike(argument)) {
                    const target = resolve(file, argument.text)
                    if (target) edge(item, target)
                    else item.unresolved.push(`External or unresolved module: ${argument.text}`)
                } else item.unresolved.push(`Dynamic import at line ${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
            }
            ts.forEachChild(node, walk)
        }
        walk(ast)
    }
    function scope(node, ast) {
        for (let parent = node.parent; parent; parent = parent.parent) if ((ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name) return parent.name.getText(ast)
        return 'module'
    }
    const methods = /^(get|post|put|patch|delete|head|options|all)$/i
    for (const [file, ast] of asts) {
        const item = nodes.get(fileId(file)), bindings = imports.get(file), occurrences = new Map()
        const nextId = label => { const n = (occurrences.get(label) || 0) + 1; occurrences.set(label, n); return `${label}:${n}` }
        function makeRoute(method, url, node, prefix = '') {
            const route = prefix + url
            const id = `api:${file}:${method.toUpperCase()}:${route}`
            if (nodes.has(id)) return
            const result = add({ id, kind: 'api', title: `${method.toUpperCase()} ${route}`, file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, content: node.getText(ast), route })
            // Include module setup, authentication hooks and imported helpers, not only the handler body.
            if (file === 'api/src/routes.ts' && node !== ast) {
                function references(part) {
                    if (ts.isIdentifier(part)) edge(result, bindings.get(part.text))
                    ts.forEachChild(part, references)
                }
                references(node)
                result.unresolved.push('Application-wide middleware is reviewed separately in the API bootstrap source.')
            } else edge(result, item.id)
            routeNodes.push(result)
        }
        function walk(node) {
            if (ts.isCallExpression(node)) {
                const expression = node.expression.getText(ast), argument = node.arguments[0], member = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : expression
                const isDatabase = ['query', 'queryOnce', 'run'].includes(member) && (member === 'query' || bindings.get(expression) === 'source:api/src/utils/db.ts')
                if (isDatabase && argument) {
                    const name = nextId(scope(node, ast))
                    const query = add({ id: `database:${file}:${name}`, kind: 'database', title: `${file} · ${name}`, file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, content: node.getText(ast) })
                    edge(query, item.id); edge(item, query.id)
                    if (!ts.isStringLiteralLike(argument)) query.unresolved.push('Computed query: expand the source file to inspect its construction and parameters.')
                }
                const receiver = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression.getText(ast) : ''
                if (file.includes('/src/') && methods.test(member) && /^(fastify|app|server|router|api)$/.test(receiver)) {
                    const prefix = file === 'api/src/handlers/ti/publicApi.ts' ? '/api/v1' : file.startsWith('api/src/') ? '/api' : ''
                    if (argument && ts.isStringLiteralLike(argument)) makeRoute(member, argument.text, node, prefix)
                    else item.unresolved.push(`Computed ${member.toUpperCase()} route at line ${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
                }
                if (member === 'fetch' || /fetch(?:Json|Api|WithAuth|Impl)?$/i.test(member)) {
                    if (argument) fetches.push({ item, text: ts.isStringLiteralLike(argument) ? argument.text : argument.getText(ast) })
                }
            }
            ts.forEachChild(node, walk)
        }
        walk(ast)
        const page = /^frontend\/src\/app\/(.*?)(page\.tsx?|route\.ts)$/.exec(file)
        if (page) {
            const route = '/' + page[1].split('/').filter(part => part && !/^\(.*\)$/.test(part) && !part.startsWith('@')).join('/')
            if (page[2].startsWith('page')) {
                const result = add({ id: `frontend:${file}`, kind: 'frontend', title: route, file, route, content: files.get(file) })
                edge(result, item.id)
                let directory = path.posix.dirname(file)
                while (directory.startsWith('frontend/src/app')) {
                    for (const layout of ['layout.tsx', 'layout.ts', 'template.tsx', 'error.tsx', 'loading.tsx', 'not-found.tsx']) if (files.has(directory + '/' + layout)) edge(result, fileId(directory + '/' + layout))
                    directory = path.posix.dirname(directory)
                }
            } else {
                const exported = [...files.get(file).matchAll(/export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(match => match[1])
                for (const method of exported.length ? exported : ['ALL']) makeRoute(method, route, ast)
            }
        }
        // Public resource routes are generated from this literal registry.
        if (file === 'api/src/handlers/ti/publicApi.ts') for (const match of files.get(file).matchAll(/^\s*'(\/[^']+)':\s*\[/gm)) makeRoute('GET', match[1], ast, '/api/v1')
    }
    for (const { item, text } of fetches) {
        const candidate = text.replace(/^`|`$/g, '').replace(/\$\{[^}]+\}/g, ':dynamic').split('?')[0]
        const suffix = candidate.replace(/^:dynamic/, '').replace(/^https?:\/\/[^/]+/, '')
        const matches = routeNodes.filter(route => {
            const pattern = route.route.split('/').map(part => part.startsWith(':') || part.startsWith('[') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')
            return suffix === route.route || (suffix.startsWith('/') && new RegExp('^' + pattern + '$').test(suffix)) || (text.includes('config.url.api') && '/api' + suffix === route.route)
        })
        for (const route of matches) edge(item, route.id)
        if (!matches.length) item.unresolved.push(`External or unresolved request: ${text}`)
    }
    for (const [file, content] of files) if (file.endsWith('.sql')) {
        const item = add({ id: `database:${file}`, kind: 'database', title: file, file, content })
        edge(item, fileId(file))
    }
    const sorted = [...nodes.values()].sort((a, b) => a.title.localeCompare(b.title, 'en'))
    for (const item of sorted) {
        item.dependencies.sort()
        item.unresolved = [...new Set(item.unresolved)]
        const visited = new Set(), stack = [item.id]
        while (stack.length) {
            const id = stack.pop()
            if (visited.has(id) || !nodes.has(id)) continue
            visited.add(id); stack.push(...nodes.get(id).dependencies)
        }
        item.reviewHash = sha256([...visited].sort().map(id => `${id}\0${nodes.get(id).sha256}`).join('\n'))
        item.dependencyCount = visited.size - 1
    }
    return { version: 1, hash: sha256(sorted.map(item => `${item.id}:${item.reviewHash}`).join('\n')), nodes: sorted }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = inventory(collectSources(path.resolve(process.argv[2])))
    fs.writeFileSync(process.argv[3], JSON.stringify(result))
    console.log(`Indexed ${result.nodes.length} review items.`)
}
