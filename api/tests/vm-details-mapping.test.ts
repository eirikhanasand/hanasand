import { expect, test } from 'bun:test'
import { refreshLocalLxdDetails, setLxdRequestForTest, setVmDetailsWriterForTest } from '../src/utils/vms/lxd.ts'

test('refresh uses the attached guest interface instead of Docker bridges and does not save failed state checks', async () => {
    let unavailable = false
    let writes = 0
    const restoreWriter = setVmDetailsWriterForTest(async details => {
        writes++
        expect(details.device_eth0_ipv4_address).toBe('10.119.85.50')
        expect(details.device_eth0_name).toBe('enp5s0')
    })
    const restoreRequest = setLxdRequestForTest(async <T>(path: string) => {
        if (path.endsWith('/state') && unavailable) throw new Error('host unavailable')
        const metadata = path.endsWith('/state') ? {
            status: 'Running',
            network: {
                docker0: { addresses: [{ family: 'inet', address: '172.17.0.1', scope: 'global' }] },
                enp5s0: { hwaddr: '00:16:3e:8f:bc:97', addresses: [{ family: 'inet', address: '10.119.85.50', scope: 'global' }] },
            },
        } : {
            name: 'cashflow', status: 'Running', config: { 'volatile.eth0.hwaddr': '00:16:3e:8f:bc:97' },
            expanded_devices: { eth0: { name: 'eth0', type: 'nic' } },
        }
        return { status_code: 200, status: 'Success', metadata: metadata as T }
    })
    try {
        const before = Date.now()
        const fresh = await refreshLocalLxdDetails('cashflow', true)
        expect(Date.parse(fresh.last_checked)).toBeGreaterThanOrEqual(before)
        expect(writes).toBe(1)
        unavailable = true
        await expect(refreshLocalLxdDetails('cashflow', true)).rejects.toThrow('host unavailable')
        expect(writes).toBe(1)
    } finally { restoreRequest(); restoreWriter() }
})
