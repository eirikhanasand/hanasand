import { afterAll, expect, mock, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
let signedIn = true
let admin = true
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: signedIn }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: admin }) }))
const root = await mkdtemp(`${tmpdir()}/docker-storage-api-`)
process.env.DOCKER_STORAGE_STATE_DIR = root
const { getDockerStorage, clearDockerStorage } = await import('../src/handlers/dockerStorage.ts')
afterAll(async () => { await rm(root, { recursive: true, force: true }) })
function reply() {
    return { code: 200, body: null as unknown, header() { return this }, status(code: number) { this.code = code; return this }, send(body: unknown) { this.body = body; return this } }
}
async function invoke(handler: typeof getDockerStorage) {
    const res = reply()
    await handler({} as never, res as never)
    return res
}
test('signed-out and non-admin requests cannot inspect or trigger cleanup', async () => {
    signedIn = false
    expect((await invoke(getDockerStorage)).code).toBe(401)
    expect((await invoke(clearDockerStorage)).code).toBe(401)
    signedIn = true; admin = false
    expect((await invoke(getDockerStorage)).code).toBe(403)
    expect((await invoke(clearDockerStorage)).code).toBe(403)
    admin = true
})
test('an initial failed scan does not return incomplete metrics to the dashboard', async () => {
    await writeFile(`${root}/status.json`, JSON.stringify({ error: 'Docker is unavailable.', running: false }))
    const response = await invoke(getDockerStorage)
    expect(response.code).toBe(503)
    expect(response.body).toEqual({ error: 'Docker is unavailable.' })
})
test('manual cleanup queues once and status comes from persistent host state', async () => {
    expect((await invoke(clearDockerStorage)).code).toBe(202)
    const request = await readFile(`${root}/request.json`, 'utf8')
    expect((await invoke(clearDockerStorage)).code).toBe(202)
    expect(await readFile(`${root}/request.json`, 'utf8')).toBe(request)
    await writeFile(`${root}/status.json`, JSON.stringify({ checkedAt: new Date().toISOString(), cacheBytes: 0, unusedImages: [], lastSuccessAt: '2026-09-18T01:00:00Z' }))
    const response = await invoke(getDockerStorage)
    expect(response.body).toMatchObject({ queued: true, stale: false, lastSuccessAt: '2026-09-18T01:00:00Z' })
})
test('standby cannot enqueue cleanup against the wrong host', async () => {
    process.env.RESILIENCE_SITE = 'ovhcloud'
    expect((await invoke(clearDockerStorage)).code).toBe(503)
    delete process.env.RESILIENCE_SITE
})
