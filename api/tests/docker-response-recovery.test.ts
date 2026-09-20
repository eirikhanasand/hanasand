import { afterAll, expect, test } from 'bun:test'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'docker-response-'))
const socket = join(directory, 'docker.sock')
const oldSocket = process.env.DOCKER_SOCKET_PATH
process.env.DOCKER_SOCKET_PATH = socket
let interrupt = true
const server = http.createServer((_req, res) => {
    if (!interrupt) return void res.end('[]')
    res.writeHead(200, { 'Content-Length': '1000' })
    res.write('[')
    setTimeout(() => res.destroy(), 10)
})
await new Promise<void>(resolve => server.listen(socket, resolve))
const { listRuntimeContainers } = await import('../src/utils/docker/engine.ts')
afterAll(() => { server.close(); rmSync(directory, { recursive: true, force: true }); if (oldSocket === undefined) delete process.env.DOCKER_SOCKET_PATH; else process.env.DOCKER_SOCKET_PATH = oldSocket })

test('an interrupted Docker response rejects promptly and subsequent collection can recover', async () => {
    const result = await Promise.race([
        listRuntimeContainers().then(() => 'unexpected success', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('stuck'), 300)),
    ])
    expect(result).toBe('rejected')
    interrupt = false
    expect(await listRuntimeContainers()).toEqual([])
})
