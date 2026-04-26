type RepositoryFile = {
    path: string
    content?: string | null
}

export type DetectedStack = {
    stackType: AIStackType
    supported: boolean
    reason: string
}

export function detectRepositoryStack(files: RepositoryFile[]): DetectedStack {
    const paths = new Set(files.map((file) => file.path))
    const packageJson = files.find((file) => file.path === 'package.json')?.content || ''
    const hasDockerCompose = paths.has('docker-compose.yml') || paths.has('docker-compose.yaml')
    const hasDockerfile = paths.has('Dockerfile')
    const hasNextConfig = ['next.config.js', 'next.config.mjs', 'next.config.ts'].some((path) => paths.has(path))
    const hasWorker = paths.has('src/worker.ts')

    if (/\bnext\b/.test(packageJson) && hasDockerCompose && hasDockerfile && hasNextConfig) {
        return {
            stackType: 'nextjs_docker',
            supported: true,
            reason: 'Detected Next.js plus Docker Compose deployment files.',
        }
    }

    if (/\bfastify\b/.test(packageJson) && /\bpg\b/.test(packageJson) && hasDockerCompose && hasDockerfile) {
        return {
            stackType: 'fastify_postgres',
            supported: true,
            reason: 'Detected Fastify + Postgres service contract with Docker Compose.',
        }
    }

    if (/\bfastify\b/.test(packageJson) && /\b(redis|ioredis)\b/.test(packageJson) && hasWorker && hasDockerCompose) {
        return {
            stackType: 'fastify_worker_redis',
            supported: true,
            reason: 'Detected Fastify worker stack with Redis and a worker entrypoint.',
        }
    }

    return {
        stackType: 'unknown',
        supported: false,
        reason: 'This workspace does not match a supported deployable stack contract yet.',
    }
}
