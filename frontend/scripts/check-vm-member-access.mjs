import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const scratch = mkdtempSync(`${tmpdir()}/vm-member-access-`)
const frontend = fileURLToPath(new URL('..', import.meta.url))
const requests = []
const api = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch(request) {
        const { pathname } = new URL(request.url)
        requests.push(pathname)
        if (pathname === '/requests') return Response.json(requests)
        if (pathname.startsWith('/api/auth/token/')) return Response.json({ roles: pathname.endsWith('/admin-proof') ? [{ id: 'system_admin', name: 'System administrator' }] : [], name: 'Member' })
        if (pathname === '/api/vms' || pathname === '/api/vm/metrics') return Response.json([])
        if (pathname.startsWith('/api/vms/')) return Response.json([{ name: 'my-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [] }])
        if (pathname === '/status') {
            writeFileSync(`${scratch}/state.json`, JSON.stringify({ updatedAt: new Date().toISOString(), compute: { memoryTotalBytes: 123 }, sites: { inspur: { compute: { diskFreeBytes: 456 } } } }))
            return Response.json({ mode: 'normal', readOnly: false, services: [], compute: { memory: 123 }, sites: { inspur: { compute: { memory: 123 } } }, replicaEligibility: { memory: 123 } })
        }
        return Response.json({})
    }
})
const env = {
    ...process.env,
    FRONTEND_INTERNAL_API: `${api.url}api`, FRONTEND_AUTH_API: `${api.url}api`,
    RESILIENCE_STATUS_URL: `${api.url}status`, RESILIENCE_STATE_FILE: `${scratch}/state.json`,
    NEXT_DIST_DIR: '.next/vm-access-check',
    PLAYWRIGHT_MANAGED_SERVERS: '0', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3267',
    VM_FIXTURE_API: api.url.toString().replace(/\/$/, '')
}
const dev = Bun.spawn(['bun', '--bun', 'next', 'dev', '--webpack', '-p', '3267'], { cwd: frontend, env, stdout: Bun.file(`${scratch}/dev.log`), stderr: Bun.file(`${scratch}/dev-error.log`) })
try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error(`VM fixture server exited; see ${scratch}`)
        if (await fetch(env.PLAYWRIGHT_BASE_URL).then(() => true).catch(() => false)) { ready = true; break }
        await Bun.sleep(500)
    }
    if (!ready) throw new Error(`VM fixture server did not start; see ${scratch}`)
    const check = Bun.spawn(['./node_modules/.bin/playwright', 'test', 'tests/vm-member-access.spec.ts', '--workers=1', '--reporter=line'], { cwd: frontend, env, stdout: 'inherit', stderr: 'inherit' })
    process.exitCode = await check.exited
} finally {
    dev.kill()
    await dev.exited
    api.stop(true)
}
