import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { lxdRequest } from '#utils/vms/lxd.ts'
import { withLiveVmStatus } from '#utils/vms/status.ts'

export default async function systemVms() {
    const [inventory, metrics, instances] = await Promise.all([
        run(await loadSQL('getFullVmList.sql')),
        run(await loadSQL('getLatestVmMetrics.sql')),
        lxdRequest<{ name: string; status: string }[]>('/1.0/instances?recursion=1', { timeout: 1500 }).catch(() => null),
    ])
    const states = new Map(instances?.metadata.map(instance => [instance.name, instance.status]))
    const vms = await Promise.all(inventory.rows.map(vm => withLiveVmStatus(vm, async name => {
        const status = states.get(name)
        if (!status) throw new Error('VM host unavailable')
        return { status }
    })))
    return { vms, vmMetrics: metrics.rows }
}
