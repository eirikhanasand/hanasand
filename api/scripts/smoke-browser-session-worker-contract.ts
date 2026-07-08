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
assert.match(ws, /SecurityOpt:\s*\[`seccomp=\$\{browserWorkerSeccompProfile\}`,\s*'apparmor=docker-default',\s*'no-new-privileges'\]/, 'session worker should keep seccomp, AppArmor, and no-new-privileges')
assert.match(ws, /BROWSER_SANDBOX_WORKER_ONLY=1/, 'session worker should boot in browser-worker-only mode')
assert.doesNotMatch(ws, /DB_PASSWORD=|VM_API_TOKEN=|MAIL_ADMIN_PASSWORD=|API_SSH_KEY=|\/var\/run\/docker\.sock|lxd\/unix\.socket/, 'session worker should not receive app secrets or host control sockets')
if (existsSync(composeUrl)) {
    const compose = readFileSync(composeUrl, 'utf8')
    const serviceBlock = (name: string) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:)`).exec(compose)?.[1] || ''
    assert.match(compose, /BROWSER_SANDBOX_PER_SESSION_WORKER:\s*\$\{BROWSER_SANDBOX_PER_SESSION_WORKER:-1\}/, 'compose should enable per-session workers by default')
    assert.match(compose, /BROWSER_SANDBOX_WORKER_NETWORK:\s*\$\{BROWSER_SANDBOX_WORKER_NETWORK:-hanasand_browsernet\}/, 'ephemeral browser workers should not join the app network by default')
    assert.match(compose, /BROWSER_SANDBOX_PREWARM:\s*"0"/, 'compose should not prewarm Chromium in the privileged API container')
    assert.match(compose, /browsernet:\s*\n\s*name:\s*hanasand_browsernet/, 'compose should define a dedicated browser worker network')
    assert.match(serviceBlock('browser-worker'), /security_opt:[\s\S]*?apparmor=docker-default[\s\S]*?no-new-privileges/, 'shared browser worker should keep AppArmor and no-new-privileges')
    assert.match(serviceBlock('api'), /networks:[\s\S]*?- browsernet/, 'API should join the browser network only for the worker websocket control path')
    assert.doesNotMatch(serviceBlock('postgres'), /- browsernet/, 'database should not join the browser worker network')
    assert.doesNotMatch(serviceBlock('stalwart'), /- browsernet/, 'mail service should not join the browser worker network')
}

console.log('Browser per-session worker isolation contract passed.')
