import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import config from '#constants'

const generatedAt = new Date().toISOString()
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const runtimeDir = path.resolve(scriptDir, '..', 'runtime', 'self-improvement')
const latestPath = path.join(runtimeDir, 'model-loopback-smoke-latest.json')
const archivePath = path.join(runtimeDir, `model-loopback-smoke-${generatedAt.replace(/[:.]/g, '-')}.json`)

async function requestJson(endpoint: string, init?: RequestInit) {
    const startedAt = Date.now()
    const response = await fetch(`${config.model_api}${endpoint}`, init)
    const text = await response.text()
    return {
        endpoint,
        ok: response.ok,
        status: response.status,
        ms: Date.now() - startedAt,
        preview: text.slice(0, 300),
    }
}

const checks = [
    await requestJson('/slots'),
    await requestJson('/apply-template', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                {
                    role: 'user',
                    content: 'Reply with the word ready.',
                },
            ],
        }),
    }),
    await requestJson('/tokenize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: 'ready',
        }),
    }),
]

const result = {
    generated_at: generatedAt,
    model_api: config.model_api,
    ok: checks.every((entry) => entry.ok),
    checks,
}

await mkdir(runtimeDir, { recursive: true })
await writeFile(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await writeFile(archivePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
    ok: result.ok,
    latestPath,
    archivePath,
    checks: checks.map((entry) => ({
        endpoint: entry.endpoint,
        ok: entry.ok,
        status: entry.status,
        ms: entry.ms,
    })),
}, null, 2))
