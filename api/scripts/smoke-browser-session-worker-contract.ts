import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const ws = readFileSync(new URL('../src/plugins/ws.ts', import.meta.url), 'utf8')
const composeUrl = new URL('../../docker-compose.yml', import.meta.url)

assert.match(ws, /BROWSER_SANDBOX_ALLOW_SHARED_WORKER !== 'unsafe-dev-only'/, 'browser proxy should require per-session workers unless an unsafe dev-only override is set')
assert.doesNotMatch(ws, /BROWSER_SANDBOX_PER_SESSION_WORKER !== '0'/, 'browser proxy should not expose a production-safe switch back to shared workers')
assert.match(ws, /createRuntimeContainer/, 'browser proxy should create an isolated worker container')
assert.match(ws, /connectBrowserWorkerSocket/, 'browser proxy should wait for the worker websocket before failing the session')
assert.match(ws, /Shared browser worker is disabled; isolated per-session workers are required in production\./, 'main API should fail closed instead of running a browser locally when shared worker config is missing')
assert.match(ws, /Init:\s*true/, 'session worker should run with Docker init enabled')
assert.match(ws, /ReadonlyRootfs:\s*true/, 'session worker root filesystem should be read-only')
assert.match(ws, /CapDrop:\s*\['ALL'\]/, 'session worker should drop Linux capabilities')
assert.match(ws, /PidsLimit:\s*512/, 'session worker should cap process creation')
assert.match(ws, /browserWorkerSeccompProfile/, 'session worker should load the bundled seccomp profile')
assert.match(ws, /SecurityOpt:\s*\[`seccomp=\$\{browserWorkerSeccompProfile\}`,\s*'apparmor=docker-default',\s*'no-new-privileges'\]/, 'session worker should keep seccomp, AppArmor, and no-new-privileges')
assert.match(ws, /BROWSER_SANDBOX_WORKER_ONLY=1/, 'session worker should boot in browser-worker-only mode')
assert.doesNotMatch(ws, /DB_PASSWORD=|VM_API_TOKEN=|MAIL_ADMIN_PASSWORD=|API_SSH_KEY=|\/var\/run\/docker\.sock|lxd\/unix\.socket/, 'session worker should not receive app secrets or host control sockets')
if (existsSync(composeUrl)) {
    const compose = readFileSync(composeUrl, 'utf8')
    const serviceBlock = (name: string) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:)`).exec(compose)?.[1] || ''
    assert.doesNotMatch(compose, /BROWSER_SANDBOX_PER_SESSION_WORKER/, 'compose should not expose a production switch back to shared browser workers')
    assert.match(compose, /BROWSER_SANDBOX_WORKER_NETWORK:\s*\$\{BROWSER_SANDBOX_WORKER_NETWORK:-hanasand_browsernet\}/, 'ephemeral browser workers should not join the app network by default')
    assert.doesNotMatch(serviceBlock('api'), /BROWSER_SANDBOX_WORKER_WS/, 'API should not default to a shared browser worker websocket in production')
    assert.doesNotMatch(serviceBlock('api'), /browser-worker:\s*\n\s*condition:/, 'API should not depend on the dev-only shared browser worker')
    assert.match(serviceBlock('browser-worker'), /profiles:\s*\n\s*-\s*unsafe-dev-only/, 'shared browser worker should be opt-in dev-only')
    assert.match(compose, /BROWSER_SANDBOX_PREWARM:\s*"0"/, 'compose should not prewarm Chromium in the privileged API container')
    assert.match(compose, /browsernet:\s*\n\s*name:\s*hanasand_browsernet/, 'compose should define a dedicated browser worker network')
    assert.match(serviceBlock('browser-worker'), /pids_limit:\s*512/, 'shared browser worker should cap process creation')
    assert.match(serviceBlock('browser-worker'), /security_opt:[\s\S]*?apparmor=docker-default[\s\S]*?no-new-privileges/, 'shared browser worker should keep AppArmor and no-new-privileges')
    assert.match(serviceBlock('api'), /networks:[\s\S]*?- browsernet/, 'API should join the browser network only for the worker websocket control path')
    assert.doesNotMatch(serviceBlock('postgres'), /- browsernet/, 'database should not join the browser worker network')
    assert.doesNotMatch(serviceBlock('stalwart'), /- browsernet/, 'mail service should not join the browser worker network')
}

console.log('Browser per-session worker isolation contract passed.')
