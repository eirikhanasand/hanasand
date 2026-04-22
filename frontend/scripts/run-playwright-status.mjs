import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const args = process.argv.slice(2)
const started = performance.now()
const apiBase = process.env.PLAYWRIGHT_API_BASE || process.env.NEXT_PUBLIC_API || 'http://127.0.0.1:8080/api'
const token = process.env.VM_API_TOKEN || ''
const checkName = process.env.PLAYWRIGHT_STATUS_CHECK_NAME || 'Playwright auth'

function postStatus(status, message) {
    if (!token) return Promise.resolve()
    return fetch(`${apiBase}/status/ingest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${encodeURIComponent(token)}`,
        },
        body: JSON.stringify({
            service: 'frontend',
            check_name: checkName,
            status,
            latency_ms: Math.round(performance.now() - started),
            message,
        }),
    }).catch(() => {})
}

const child = spawn('bunx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    env: process.env,
})

child.on('exit', async code => {
    await postStatus(code === 0 ? 'up' : 'down', code === 0 ? `${checkName} passed.` : `${checkName} failed with exit code ${code}.`)
    process.exit(code ?? 1)
})
