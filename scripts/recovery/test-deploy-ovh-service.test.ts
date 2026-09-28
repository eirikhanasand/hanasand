import { describe, expect, test } from 'bun:test'
import { check, dockerRunArgs, settingsFor } from './deploy-ovh-service.ts'

const release = 'a'.repeat(40)
const original = (port: number) => ({ Config: { Env: [`PORT=${port}`, 'PRIVATE_VALUE=fixture',
    'RECOVERY_STATUS_URL=http://127.0.0.1:19901/status', 'RECOVERY_STATE_FILE=/recovery/state.json'] },
HostConfig: { NetworkMode: 'host', Memory: 2147483648, NanoCpus: 1000000000,
    RestartPolicy: { Name: 'unless-stopped' }, ExtraHosts: ['kept:127.0.0.2'] }, State: { Running: true },
Mounts: [{ Type: 'bind', Source: '/fixture', Destination: '/recovery', RW: false }] })

describe('OVH staged deployment config', () => {
    test('preserves runtime settings and adds only approved service settings', () => {
        for (const [kind, port] of [['frontend', 19300], ['api', 19080], ['auth', 19090]] as const) {
            const old = original(port)
            const settings = settingsFor(kind, old, release)
            const { args, env } = dockerRunArgs(kind, `candidate-${kind}`, port + 1, release, old, settings)
            expect(env.PRIVATE_VALUE).toBe('fixture')
            expect(args).not.toContain('PRIVATE_VALUE=fixture')
            expect(env.PWNED_LOOKUP_API).toBe('https://api.hanasand.com/api/pwned')
            expect(args).toContain('/fixture:/recovery:ro')
            expect(args).toContain('kept:127.0.0.2')
            expect(env.PORT).toBe(String(port + 1))
            if (kind === 'frontend') {
                expect(env.RECOVERY_STATUS_URL).toBe('http://127.0.0.1:19901/status')
                expect(env.RECOVERY_STATE_FILE).toBe('/recovery/state.json')
            }
            if (kind === 'api') {
                expect(env.API_HTTP_ONLY).toBe('1')
                expect(env.RECOVERY_ESSENTIAL_ONLY).toBe('1')
                expect(env.RECOVERY_STATE_FILE).toBe('/resilience/state.json')
            }
        }
    })

    test('requires the expected running host-network service and a valid full release', () => {
        expect(() => settingsFor('frontend', original(19301), release)).toThrow('Expected the running OVH')
        expect(() => settingsFor('frontend', { ...original(19300), State: { Running: false } }, release)).toThrow('Expected the running OVH')
    })

    test('frontend health verification checks release and both compact indexes', async () => {
        const calls: Array<[string, any]> = []
        const request = async (url: string | URL, init?: any) => {
            calls.push([String(url), init])
            if (String(url).endsWith('/api/recovery/ready')) return new Response(JSON.stringify({ ok: true, release }), { status: 200 })
            return new Response(Buffer.concat([Buffer.from('PWNPRF02'), Buffer.from([2, 0, 0, 0])]), {
                status: 200, headers: { 'Content-Type': 'application/vnd.hanasand.pwned-prefix' },
            })
        }
        await check('frontend', 19301, 'candidate', release, request as typeof fetch)
        expect(calls).toHaveLength(2)
        expect(calls[1][1].method).toBe('POST')
        expect(calls[1][1].body).toBe(JSON.stringify({ prefix: 'B79CF' }))
        await expect(check('frontend', 19301, 'candidate', 'b'.repeat(40), async url =>
            String(url).endsWith('/ready') ? new Response(JSON.stringify({ ok: false }), { status: 503 }) : new Response('bad'), async () => {})).rejects.toThrow('Service readiness check failed')
    })
})
