import assert from 'node:assert/strict'
import { detectRepositoryStack } from '../src/utils/ai/stack.ts'

type Fixture = {
    name: string
    expected: AIStackType
    files: Array<{ path: string, content?: string }>
}

const packageJson = (dependencies: Record<string, string>) => JSON.stringify({ dependencies }, null, 2)

const fixtures: Fixture[] = [
    {
        name: 'Next.js Docker app',
        expected: 'nextjs_docker',
        files: [
            { path: 'package.json', content: packageJson({ next: '^15.0.0', react: '^19.0.0' }) },
            { path: 'Dockerfile', content: 'FROM node:24-alpine' },
            { path: 'docker-compose.yml', content: 'services:\n  web:\n    build: .' },
            { path: 'next.config.ts', content: 'export default {}' },
        ],
    },
    {
        name: 'Fastify Postgres API',
        expected: 'fastify_postgres',
        files: [
            { path: 'package.json', content: packageJson({ fastify: '^5.0.0', pg: '^8.0.0' }) },
            { path: 'Dockerfile', content: 'FROM oven/bun:1' },
            { path: 'docker-compose.yaml', content: 'services:\n  api:\n    build: .\n  db:\n    image: postgres:17' },
        ],
    },
    {
        name: 'Fastify worker Redis app',
        expected: 'fastify_worker_redis',
        files: [
            { path: 'package.json', content: packageJson({ fastify: '^5.0.0', ioredis: '^5.0.0' }) },
            { path: 'docker-compose.yml', content: 'services:\n  redis:\n    image: redis:7' },
            { path: 'src/worker.ts', content: 'export async function work() {}' },
        ],
    },
    {
        name: 'Unsupported static folder',
        expected: 'unknown',
        files: [
            { path: 'index.html', content: '<h1>Hello</h1>' },
            { path: 'package.json', content: packageJson({}) },
        ],
    },
]

for (const fixture of fixtures) {
    const detected = detectRepositoryStack(fixture.files)
    assert.equal(detected.stackType, fixture.expected, `${fixture.name} detected as ${detected.stackType}`)
    assert.equal(detected.supported, fixture.expected !== 'unknown', `${fixture.name} support flag mismatch`)
}

console.log(`AI stack contract smoke passed for ${fixtures.length} fixtures.`)
