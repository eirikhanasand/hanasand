import { afterEach, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { getInferenceHealth, getModelHealth } from '../src/handlers/ai/health.ts'

const original = process.env.AI_HEALTH_WORKER_BASE
afterEach(() => {
    if (original === undefined) delete process.env.AI_HEALTH_WORKER_BASE
    else process.env.AI_HEALTH_WORKER_BASE = original
})

test('HTTP replicas use the inference worker and retain real failures', async () => {
    let status = 200
    let invalid = false
    const calls: string[] = []
    const worker = Bun.serve({ port: 0, fetch(request) {
        calls.push(new URL(request.url).pathname)
        expect(request.headers.get('x-ai-health-forwarded')).toBe('1')
        return Response.json(invalid ? { ok: true } : { ok: status === 200, connectedModels: 1, checkedAt: '2026-09-12T13:00:00Z', latencyMs: 123 }, { status })
    } })
    process.env.AI_HEALTH_WORKER_BASE = worker.url.toString()
    const app = Fastify()
    app.get('/inference', getInferenceHealth)
    app.get('/models', getModelHealth)
    try {
        const healthy = await app.inject('/inference')
        expect(healthy.statusCode).toBe(200)
        expect(healthy.json()).toMatchObject({ ok: true, connectedModels: 1, latencyMs: 123 })
        expect(healthy.headers['cache-control']).toBe('no-store')
        expect((await app.inject('/models')).statusCode).toBe(200)
        expect(calls).toEqual(['/api/ai/health/inference', '/api/ai/health/models'])
        status = 503
        const failed = await app.inject('/inference')
        expect(failed.statusCode).toBe(503)
        expect(failed.json().ok).toBe(false)
        invalid = true
        status = 200
        expect((await app.inject('/inference')).statusCode).toBe(503)
        const count = calls.length
        expect((await app.inject({ url: '/inference', headers: { 'x-ai-health-forwarded': '1' } })).statusCode).toBe(503)
        expect(calls).toHaveLength(count)
        worker.stop(true)
        expect((await app.inject('/inference')).statusCode).toBe(503)
        delete process.env.AI_HEALTH_WORKER_BASE
        const local = await app.inject('/inference')
        expect(local.statusCode).toBe(503)
        expect(local.json().error).toBe('No model is connected.')
    } finally {
        worker.stop(true)
        await app.close()
    }
})
