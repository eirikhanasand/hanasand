import type { ShareRuntimeCapability } from './runtimeCapabilities'

export type PreviewHealth = 'idle' | 'checking' | 'reachable' | 'unreachable'

export type PreviewRuntime = {
    canRun: boolean
    framework: string
    command: string | null
    healthPath: string
    port: string | null
    confidence: 'high' | 'medium' | 'low'
    reason: string
    action: string
    evidence: string[]
}

type PreviewInput = {
    share: Share | null
    tree: Tree | null
    activePath: string | null
    activeContent: string
    capability: ShareRuntimeCapability
}

type PackageJsonHint = {
    scripts: Record<string, string>
    dependencies: Set<string>
}

const defaultPort = '3000'

export function getPreviewRuntime({
    share,
    tree,
    activePath,
    activeContent,
    capability,
}: PreviewInput): PreviewRuntime {
    const paths = collectPaths(tree)
    const lowerPaths = paths.map(path => path.toLowerCase())
    const basenames = lowerPaths.map(path => path.split('/').at(-1) || path)
    const activeName = activePath?.split('/').at(-1)?.toLowerCase() || share?.path?.split('/').at(-1)?.toLowerCase() || ''
    const packageHint = parsePackageJson(activeName === 'package.json' ? activeContent : '')
    const evidence = [...capability.evidence]
    const port = capability.port || inferPortFromScripts(packageHint.scripts) || defaultPort

    function runtime(
        framework: string,
        command: string,
        reason: string,
        confidence: PreviewRuntime['confidence'] = 'high',
        healthPath = '/',
    ): PreviewRuntime {
        return {
            canRun: true,
            framework,
            command,
            healthPath,
            port,
            confidence,
            reason,
            action: `Run ${command}, then open Preview.`,
            evidence: unique(evidence.length ? evidence : [framework]),
        }
    }

    const devScript = packageHint.scripts.dev
    const startScript = packageHint.scripts.start
    const hasDependency = (name: string) => packageHint.dependencies.has(name)
    const hasBasename = (name: string) => basenames.includes(name)
    const hasPath = (pattern: RegExp) => lowerPaths.some(path => pattern.test(path))

    if (hasBasename('docker-compose.yml') || hasBasename('docker-compose.yaml') || hasBasename('compose.yml') || hasBasename('compose.yaml')) {
        return runtime('Docker Compose', 'docker compose up --build', 'Compose file detected; Preview can attach once the service is serving HTTP.', 'high')
    }

    if (hasBasename('dockerfile')) {
        return runtime('Docker', `docker build -t preview-app . && docker run --rm -p ${port}:${port} preview-app`, 'Dockerfile detected; Preview can open the published HTTP port.', 'medium')
    }

    if (hasBasename('next.config.js') || hasBasename('next.config.mjs') || hasBasename('next.config.ts') || hasDependency('next')) {
        return runtime('Next.js', devScript ? 'npm run dev -- --hostname 0.0.0.0' : 'npx next dev --hostname 0.0.0.0', 'Next.js project detected; run the dev server on all interfaces.')
    }

    if (hasBasename('vite.config.js') || hasBasename('vite.config.ts') || hasDependency('vite')) {
        return runtime('Vite', devScript ? 'npm run dev -- --host 0.0.0.0' : 'npx vite --host 0.0.0.0', 'Vite project detected; run the dev server with host access enabled.')
    }

    if (hasBasename('astro.config.mjs') || hasBasename('astro.config.ts') || hasDependency('astro')) {
        return runtime('Astro', devScript ? 'npm run dev -- --host 0.0.0.0' : 'npx astro dev --host 0.0.0.0', 'Astro project detected; run the dev server with host access enabled.')
    }

    if (hasBasename('nuxt.config.js') || hasBasename('nuxt.config.ts') || hasDependency('nuxt')) {
        return runtime('Nuxt', devScript ? 'npm run dev -- --host 0.0.0.0' : 'npx nuxt dev --host 0.0.0.0', 'Nuxt project detected; run the dev server with host access enabled.')
    }

    if (hasBasename('svelte.config.js') || hasDependency('@sveltejs/kit')) {
        return runtime('SvelteKit', devScript ? 'npm run dev -- --host 0.0.0.0' : 'npx vite dev --host 0.0.0.0', 'SvelteKit project detected; run the dev server with host access enabled.')
    }

    if (hasDependency('express') || hasDependency('fastify') || hasDependency('hono') || hasPath(/(^|\/)(server|app|index)\.(mjs|js|ts)$/)) {
        return runtime('Node server', startScript ? 'npm start' : devScript ? 'npm run dev' : 'node server.js', 'Node HTTP server detected; start it before opening Preview.', 'medium')
    }

    if (hasBasename('index.html')) {
        return runtime('Static site', `npx serve . -l ${port}`, 'Static HTML detected; serve the folder before opening Preview.', 'medium')
    }

    if (capability.hasHttpSurface) {
        return runtime('Web project', startScript ? 'npm start' : devScript ? 'npm run dev' : `PORT=${port} npm start`, capability.reason, 'low')
    }

    return {
        canRun: false,
        framework: 'No runnable preview detected',
        command: null,
        healthPath: '/',
        port: null,
        confidence: 'low',
        reason: 'This workspace does not expose a web server yet.',
        action: 'Add a package.json script, Dockerfile, compose file, or index.html to enable Preview.',
        evidence: [],
    }
}

export function previewHealthCopy(health: PreviewHealth, runtime: PreviewRuntime) {
    switch (health) {
        case 'checking':
            return 'Checking preview...'
        case 'reachable':
            return 'Preview reachable.'
        case 'unreachable':
            return runtime.command
                ? `Preview is not responding yet. ${runtime.action}`
                : runtime.action
        case 'idle':
        default:
            return runtime.canRun ? 'Preview has not been opened yet.' : runtime.reason
    }
}

function collectPaths(tree: Tree | null): string[] {
    const paths: string[] = []

    function walk(items: FileItem[], prefix = '') {
        for (const item of items) {
            const path = prefix ? `${prefix}/${item.name}` : item.name
            paths.push(path)
            if (item.type === 'folder') {
                walk(item.children, path)
            }
        }
    }

    if (Array.isArray(tree)) {
        walk(tree)
    }

    return paths
}

function parsePackageJson(content: string): PackageJsonHint {
    if (!content.trim()) {
        return { scripts: {}, dependencies: new Set() }
    }

    try {
        const parsed = JSON.parse(content) as {
            scripts?: Record<string, unknown>
            dependencies?: Record<string, unknown>
            devDependencies?: Record<string, unknown>
        }
        return {
            scripts: Object.fromEntries(Object.entries(parsed.scripts || {}).filter(([, value]) => typeof value === 'string')) as Record<string, string>,
            dependencies: new Set([
                ...Object.keys(parsed.dependencies || {}),
                ...Object.keys(parsed.devDependencies || {}),
            ]),
        }
    } catch {
        return { scripts: {}, dependencies: new Set() }
    }
}

function inferPortFromScripts(scripts: Record<string, string>) {
    const joined = Object.values(scripts).join('\n')
    return joined.match(/\b(?:--port\s+|-p\s+|PORT=)(\d{2,5})\b/)?.[1] || null
}

function unique(values: string[]) {
    return Array.from(new Set(values))
}
