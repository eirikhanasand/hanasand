import { afterAll, expect, test } from 'bun:test'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'docker-response-'))
const socket = join(directory, 'docker.sock')
const oldSocket = process.env.DOCKER_SOCKET_PATH
process.env.DOCKER_SOCKET_PATH = socket
let mode = 'interrupt'
const server = http.createServer((_req, res) => {
    if (mode === 'healthy') return void res.end('[]')
    res.writeHead(200, { 'Content-Length': '1000' })
    res.write('[')
    if (mode === 'interrupt') setTimeout(() => res.destroy(), 10)
    else {
        const timer = setInterval(() => res.write(' '), 10)
        res.on('close', () => clearInterval(timer))
    }
})
await new Promise<void>(resolve => server.listen(socket, resolve))
const { listRuntimeContainers } = await import('../src/utils/docker/engine.ts')
afterAll(() => { server.closeAllConnections(); server.close(); rmSync(directory, { recursive: true, force: true }); if (oldSocket === undefined) delete process.env.DOCKER_SOCKET_PATH; else process.env.DOCKER_SOCKET_PATH = oldSocket })

test('an interrupted Docker response rejects promptly and subsequent collection can recover', async () => {
    const result = await Promise.race([
        listRuntimeContainers().then(() => 'unexpected success', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('stuck'), 300)),
    ])
    expect(result).toBe('rejected')
    mode = 'healthy'
    expect(await listRuntimeContainers()).toEqual([])
})


test('a Docker response that never finishes has an absolute deadline', async () => {
    mode = 'dribble'
    const result = await Promise.race([
        listRuntimeContainers().then(() => 'unexpected success', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('stuck'), 4500)),
    ])
    expect(result).toBe('rejected')
}, 6000)
