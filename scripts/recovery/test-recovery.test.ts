import { describe, expect, test } from 'bun:test'
import { applyDnsPlacement, chooseService, publicState, restoreSlots, stableObservation, trackReplicaLag, transitionEmbed } from './monitor.ts'
import { reconcile } from './dns.ts'
import { render } from './render_proxy.ts'

const service = { id: 'api', name: 'API', instances: [
    { id: 'inspur-api-1', site: 'inspur', endpoint: 'https://api.hanasand.com' },
    { id: 'inspur-api-2', site: 'inspur', endpoint: 'https://api.hanasand.com' },
    { id: 'ovh-api', site: 'ovhcloud', endpoint: 'https://api.hanasand.com' },
] }

describe('recovery decisions', () => {
    test('preserves lost WAL state and times replica lag across samples', () => {
        const slot = 'hanasand_ovh_standby'
        expect(restoreSlots({ slots: [{ slot, walStatus: 'lost' }] }, [])).toEqual([slot])
        expect(restoreSlots({}, [slot])).toEqual([slot])
        expect(restoreSlots({ slots: [{ slot, walStatus: 'reserved', active: true, lagBytes: 0 }] }, [slot])).toEqual([])
        const lagging = { slots: [{ slot: 'hanasand_inspur_standby', walStatus: 'reserved', active: true, lagBytes: 2_000_000 }] }
        trackReplicaLag(lagging, {}, 100)
        expect(lagging.slots[0].lagSince).toBe(100)
        const later = structuredClone(lagging)
        trackReplicaLag(later, lagging, 170)
        expect(later.slots[0].lagSince).toBe(100)
        const caught = { slots: [{ ...lagging.slots[0], lagBytes: 1_048_576 }] }
        trackReplicaLag(caught, later, 180)
        expect(caught.slots[0].lagSince).toBeNull()
    })

    test('chooses the first healthy instance and describes failover and recovery', () => {
        const primary = chooseService(service, { 'inspur-api-1': true, 'inspur-api-2': true, 'ovh-api': true })
        const local = chooseService(service, { 'inspur-api-1': false, 'inspur-api-2': true, 'ovh-api': true })
        const remote = chooseService(service, { 'inspur-api-1': false, 'inspur-api-2': false, 'ovh-api': true })
        expect(primary.activeInstance).toBe('inspur-api-1')
        expect(local.activeInstance).toBe('inspur-api-2')
        expect(remote.activeSite).toBe('ovhcloud')
        expect(transitionEmbed(primary, local, [local]).description).toContain('inspur-api-1 stopped responding')
        const partial = transitionEmbed(remote, local, [local])
        expect(partial.color).toBe(0x00cc66)
        expect(partial.description).toContain('Traffic is back on Inspur through inspur-api-2.')
        expect(transitionEmbed(primary, chooseService(service, {}), []).description).toContain('None of the instances are responding')
        expect(applyDnsPlacement([primary], { 'api.hanasand.com': { activeSite: 'ovhcloud' } })[0].activeInstance).toBe('ovh-api')
        expect(applyDnsPlacement([primary], { 'api.hanasand.com': { activeSite: 'inspur' } })[0].activeInstance).toBe('inspur-api-1')
    })

    test('hides private recovery fields and requires stable observations', () => {
        const state = { sampledAt: 100, updatedAt: 'now', mode: 'normal', readOnly: false, services: [],
            compute: { memoryTotalBytes: 123 }, sites: { inspur: { compute: { diskFreeBytes: 456 } } }, replicaEligibility: { memory: 123 } }
        const publicValue = publicState(state, false, 110)
        expect(publicValue).not.toHaveProperty('compute')
        expect(publicValue).not.toHaveProperty('sites')
        expect(publicState(state, true, 110).compute).toEqual(state.compute)
        const initial = { healthy: true, observed: true, count: 3 }
        const failed = stableObservation(initial, false, 100)
        expect(stableObservation(failed, false, 159).healthy).toBe(true)
        expect(stableObservation(failed, false, 160).healthy).toBe(false)
    })

    test('DNS failover waits for stability and refuses records outside its scope', async () => {
        const record = { id: 1, host: 'api', type: 'A', data: '192.0.2.1', ttl: 60, checkPath: '/health' }
        const config = { enabled: true, domainId: 1, primaryIp: '192.0.2.1', standbyIp: '192.0.2.2', records: [record] }
        const api = async (_config, _pathname, payload) => { if (payload) Object.assign(record, payload); return { ...record } }
        const failoverProbe = (_host, ip) => ip === config.standbyIp
        const [, early] = await reconcile(config, { affected: ['API'] }, { 'api.hanasand.com': { candidate: 'ovhcloud', candidateSince: 41 } }, 100, { api, probe: failoverProbe })
        expect(early).toHaveLength(0)
        const [state, events] = await reconcile(config, { affected: ['API'] }, { 'api.hanasand.com': { candidate: 'ovhcloud', candidateSince: 39 } }, 100, { api, probe: failoverProbe })
        expect(record.data).toBe(config.standbyIp)
        expect(events[0].color).toBe(0xff0000)
        expect(state['api.hanasand.com'].activeSite).toBe('ovhcloud')
        await expect(reconcile({ ...config, records: [{ ...record, host: 'mail' }] }, {}, {}, 100, { api, probe: failoverProbe })).rejects.toThrow('outside allowed scope')
    })

    test('proxy config keeps readiness separate from serving ports', () => {
        const output = render({ services: [{ id: 'intelligence', listenPort: 18097, checkPath: '/v1/health', instances: [
            { id: 'inspur-ti-1', address: '172.20.0.6:8097', checkPort: 8098 }, { id: 'inspur-ti-2', address: '127.0.0.1:18102' },
        ] }] })
        expect(output).toContain('server inspur-ti-1 172.20.0.6:8097 check port 8098')
        expect(output).toContain('server inspur-ti-2 127.0.0.1:18102 check backup')
        expect(output).toContain('uri /v1/health')
    })
})
