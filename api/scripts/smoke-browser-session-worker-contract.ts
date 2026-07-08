import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const ws = readFileSync(new URL('../src/plugins/ws.ts', import.meta.url), 'utf8')
const composeUrl = new URL('../../docker-compose.yml', import.meta.url)

assert.match(ws, /BROWSER_SANDBOX_PER_SESSION_WORKER !== '0'/, 'browser proxy should default to per-session workers')
assert.match(ws, /createRuntimeContainer/, 'browser proxy should create an isolated worker container')
assert.match(ws, /connectBrowserWorkerSocket/, 'browser proxy should wait for the worker websocket before failing the session')
assert.match(ws, /ReadonlyRootfs:\s*true/, 'session worker root filesystem should be read-only')
assert.match(ws, /CapDrop:\s*\['ALL'\]/, 'session worker should drop Linux capabilities')
assert.match(ws, /browserWorkerSeccompProfile/, 'session worker should load the bundled seccomp profile')
assert.match(ws, /SecurityOpt:\s*\[`seccomp=\$\{browserWorkerSeccompProfile\}`,\s*'no-new-privileges'\]/, 'session worker should keep seccomp and no-new-privileges')
assert.match(ws, /BROWSER_SANDBOX_WORKER_ONLY=1/, 'session worker should boot in browser-worker-only mode')
if (existsSync(composeUrl)) {
    const compose = readFileSync(composeUrl, 'utf8')
    assert.match(compose, /BROWSER_SANDBOX_PER_SESSION_WORKER:\s*\$\{BROWSER_SANDBOX_PER_SESSION_WORKER:-1\}/, 'compose should enable per-session workers by default')
    assert.match(compose, /BROWSER_SANDBOX_PREWARM:\s*"0"/, 'compose should not prewarm Chromium in the privileged API container')
}

console.log('Browser per-session worker isolation contract passed.')
