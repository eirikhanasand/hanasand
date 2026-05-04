export type ShareRuntimeCapability = {
    hasHttpSurface: boolean
    canDeploy: boolean
    canPreview: boolean
    reason: string
    port: string | null
    evidence: string[]
}

type CapabilityInput = {
    share: Share | null
    tree: Tree | null
    activeContent: string
}

const httpFileNames = new Set([
    'dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'package.json',
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'vite.config.js',
    'vite.config.ts',
    'astro.config.mjs',
    'astro.config.ts',
    'nuxt.config.js',
    'nuxt.config.ts',
    'svelte.config.js',
    'index.html',
])

const serverFileNames = new Set([
    'server.js',
    'server.ts',
    'server.mjs',
    'app.js',
    'app.ts',
    'main.go',
    'main.py',
    'app.py',
    'wsgi.py',
    'asgi.py',
])

export function getShareRuntimeCapability({
    share,
    tree,
    activeContent,
}: CapabilityInput): ShareRuntimeCapability {
    const names = collectTreeNames(tree)
    const lowerNames = names.map(name => name.toLowerCase())
    const basenames = lowerNames.map(name => name.split('/').at(-1) || name)
    const normalizedContent = activeContent || share?.content || ''
    const evidence: string[] = []

    const hasDockerfile = basenames.some(name => name === 'dockerfile' || name.startsWith('dockerfile.'))
    const hasCompose = basenames.some(name => name === 'docker-compose.yml' || name === 'docker-compose.yaml' || name === 'compose.yml' || name === 'compose.yaml')
    const hasHttpFile = basenames.some(name => httpFileNames.has(name))
    const hasServerFile = basenames.some(name => serverFileNames.has(name)) || lowerNames.some(name => name.includes('/api/') || name.includes('/routes/'))
    const contentHasHttpServer = /\b(?:createServer|listen|ListenAndServe|FastAPI|Flask|uvicorn|gunicorn|serve|http\.Server)\b|(?:express|fastify)\s*\(/i.test(normalizedContent)
    const contentHasPackageHttp = /"(next|vite|astro|nuxt|svelte-kit|express|fastify|@nestjs\/core|hono)"\s*:/i.test(normalizedContent)
    const port = findPort(normalizedContent)

    if (hasDockerfile) evidence.push('Dockerfile')
    if (hasCompose) evidence.push('compose file')
    if (port) evidence.push(`port ${port}`)
    if (contentHasPackageHttp) evidence.push('web package')
    if (hasServerFile || contentHasHttpServer) evidence.push('server code')
    if (hasHttpFile && !evidence.length) evidence.push('web file')

    const hasKnownWebRuntime = hasHttpFile || contentHasPackageHttp
    const hasHttpSurface = hasDockerfile
        || hasCompose
        || hasKnownWebRuntime
        || hasServerFile
        || contentHasHttpServer
        || Boolean(port)

    const canDeploy = hasDockerfile
        || hasCompose
        || Boolean(port)
        || hasKnownWebRuntime

    const reason = !hasHttpSurface
        ? 'This share does not look like an HTTP app.'
        : canDeploy
            ? evidence.length ? `Detected ${evidence.join(', ')}.` : 'Detected a deployable web project.'
            : 'HTTP code was detected, but no Dockerfile, compose file, known web runtime, or port mapping was found.'

    return {
        hasHttpSurface,
        canDeploy,
        canPreview: hasHttpSurface && Boolean(share?.alias),
        reason,
        port,
        evidence,
    }
}

function collectTreeNames(tree: Tree | null): string[] {
    if (!Array.isArray(tree)) return []

    const names: string[] = []

    function walk(items: FileItem[], prefix = '') {
        for (const item of items) {
            const path = prefix ? `${prefix}/${item.name}` : item.name
            names.push(path)
            if (item.type === 'folder') {
                walk(item.children, path)
            }
        }
    }

    walk(tree)
    return names
}

function findPort(content: string) {
    const match = content.match(/\b(?:EXPOSE\s+|PORT\s*[=:]\s*|listen\s*\(\s*|ListenAndServe\s*\(\s*["']?:)(\d{2,5})\b/i)
    return match?.[1] || null
}
