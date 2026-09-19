import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let authenticated = false
let administrator = false
let checks = 0
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
mock.module('../src/utils/systemCronMonitor.ts', () => ({ monitorSystemCronJobs: async () => { checks++; return { jobs: [{ id: 'blocked-job', status: 'blocked' }] } } }))
const { postSystemCronMonitor } = await import('../src/handlers/systemCron.ts')

test('only system administrators can trigger job case monitoring', async () => {
    const app = Fastify()
    app.post('/system/cron/monitor', postSystemCronMonitor)
    try {
        expect((await app.inject({ method: 'POST', url: '/system/cron/monitor' })).statusCode).toBe(401)
        authenticated = true
        expect((await app.inject({ method: 'POST', url: '/system/cron/monitor' })).statusCode).toBe(403)
        expect(checks).toBe(0)
        administrator = true
        const response = await app.inject({ method: 'POST', url: '/system/cron/monitor' })
        expect(response.statusCode).toBe(200)
        expect(response.json().jobs).toEqual([{ id: 'blocked-job', status: 'blocked' }])
        expect(checks).toBe(1)
    } finally {
        await app.close()
    }
})
