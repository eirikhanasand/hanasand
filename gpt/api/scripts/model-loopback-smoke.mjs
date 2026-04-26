import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const generatedAt = new Date().toISOString()
const modelUrl = process.env.HANASAND_BENCHMARK_MODEL_URL || 'http://127.0.0.1:18081'
const runtimeDir = path.resolve('runtime', 'self-improvement')
const latestPath = path.join(runtimeDir, 'model-loopback-smoke-latest.json')
const archivePath = path.join(runtimeDir, `model-loopback-smoke-${generatedAt.replace(/[:.]/g, '-')}.json`)

const checks = [
    await requestJson(modelUrl, '/slots'),
    await requestJson(modelUrl, '/apply-template', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer no-key',
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
    await requestJson(modelUrl, '/tokenize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer no-key',
        },
        body: JSON.stringify({
            content: 'ready',
        }),
    }),
]

const result = {
    generated_at: generatedAt,
    model_api: modelUrl,
    ok: checks.every((entry) => entry.ok || entry.status === 503),
    checks,
}

await fs.mkdir(runtimeDir, { recursive: true })
await fs.writeFile(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await fs.writeFile(archivePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')

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

async function requestJson(modelUrl, endpoint, init) {
    const startedAt = Date.now()
    const args = ['-sS']
    if (init?.method === 'POST') {
        args.push('-X', 'POST')
    }
    const headers = init?.headers ? Object.entries(init.headers) : []
    for (const [name, value] of headers) {
        args.push('-H', `${name}: ${value}`)
    }
    if (typeof init?.body === 'string') {
        args.push('--data', init.body)
    }
    args.push('--write-out', '\n%{http_code}', `${modelUrl}${endpoint}`)

    const { stdout, stderr } = await execFileAsync('curl', args)
    const output = `${stdout}${stderr || ''}`.trimEnd()
    const newline = output.lastIndexOf('\n')
    const text = newline >= 0 ? output.slice(0, newline) : output
    const status = Number(newline >= 0 ? output.slice(newline + 1) : 0)
    return {
        endpoint,
        ok: status >= 200 && status < 300,
        status,
        ms: Date.now() - startedAt,
        preview: text.slice(0, 300),
    }
}
