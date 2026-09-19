import { expect, test, mock } from 'bun:test'
import { parseStats } from '../src/utils/docker/engine.ts'

test('idle containers report zero CPU while missing samples remain unavailable', () => {
    const cpu = { cpu_usage: { total_usage: 500 }, system_cpu_usage: 20000, online_cpus: 4 }
    expect(parseStats({ cpu_stats: cpu, precpu_stats: { ...cpu, system_cpu_usage: 10000 } }).cpu_percent).toBe(0)
    expect(parseStats({ cpu_stats: cpu }).cpu_percent).toBeNull()
    expect(parseStats({ cpu_stats: { ...cpu, cpu_usage: { total_usage: 1500 } }, precpu_stats: { ...cpu, system_cpu_usage: 10000 } }).cpu_percent).toBe(40)
})
let authenticated = true, admin = false
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async () => authenticated ? { user: { id: 'member' } } : null }))
mock.module('../src/utils/loadSQL.ts', () => ({ loadSQL: async () => 'role' }))
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [{ has_role: admin }] }) }))
const { canViewSystem } = await import('../src/handlers/metrics/systemStream.ts')
test('live system telemetry requires an active administrator session', async () => {
    expect(await canViewSystem('member', 'test')).toBe(false)
    admin = true
    expect(await canViewSystem('member', 'test')).toBe(true)
    authenticated = false
    expect(await canViewSystem('member', 'test')).toBe(false)
})
