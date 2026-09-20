import { afterAll, expect, spyOn, test } from 'bun:test'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'docker-response-'))
const socket = join(directory, 'docker.sock')
const oldSocket = process.env.DOCKER_SOCKET_PATH
process.env.DOCKER_SOCKET_PATH = socket
let mode = 'interrupt'
const requests: string[] = []
const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`)
    if (req.method === 'DELETE') return void res.end('{}')
    if (mode === 'conflict') { res.writeHead(409); res.end('Name already exists'); return }
    if (mode === 'slow-create') return void setTimeout(() => res.end('{"Id":"new-browser"}'), 8500)
    if (mode === 'hang') return
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
const { listRuntimeContainers, createRuntimeContainer, startRuntimeContainer } = await import('../src/utils/docker/engine.ts')
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

test('browser creation can finish after the former eight-second deadline', async () => {
    mode = 'slow-create'
    expect(await createRuntimeContainer('slow-browser', { Image: 'browser' })).toBe('new-browser')
}, 10000)

test('container creation and start remain bounded, with cleanup only for timed-out creates', async () => {
    const realSetTimeout = globalThis.setTimeout
    const deadlines: number[] = []
    const timer = spyOn(globalThis, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, delay: number, ...args: unknown[]) => {
        deadlines.push(delay)
        return realSetTimeout(callback, delay === 60_000 ? 100 : delay, ...args)
    }) as typeof setTimeout)
    try {
        requests.length = 0
        mode = 'hang'
        await expect(createRuntimeContainer('timed-out-browser', {})).rejects.toThrow('Docker API timed out')
        expect(requests).toContain('DELETE /containers/timed-out-browser?force=1&v=1')
        await expect(startRuntimeContainer('starting-browser')).rejects.toThrow('Docker API timed out')
        expect(deadlines.filter(delay => delay === 60_000)).toHaveLength(2)
        requests.length = 0
        mode = 'conflict'
        await expect(createRuntimeContainer('existing-browser', {})).rejects.toThrow('Name already exists')
        expect(requests.some(request => request.startsWith('DELETE'))).toBe(false)
    } finally { timer.mockRestore() }
})
