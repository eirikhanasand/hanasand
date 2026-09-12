import { vmLifecycleLock } from './lifecycleLock.ts'
import config from '#constants'
import run from '#db'
import { getLocalLxdInstance, lxdRequest, setLocalLxdInstanceState } from './lxd.ts'

type AlwaysRunningVm = { name: string, primary_host: string }

/** Apply the policy to the real instance before acknowledging a toggle. */
export async function applyAlwaysRunning(vm: AlwaysRunningVm, enabled: boolean) {
    if ((await run('SELECT name FROM vms WHERE name = $1 AND deleted_at IS NOT NULL', [vm.name])).rows.length) throw new Error('This VM is scheduled for deletion.')
    if (vm.primary_host.toLowerCase() !== config.vm_host_id.toLowerCase()) {
        throw new Error('The container must be managed by its primary host.')
    }
    const instance = await getLocalLxdInstance(vm.name)
    const value = String(enabled)
    if (instance.config?.['user.hanasand.always_running'] !== value || instance.config?.['boot.autostart'] !== value) {
        const operation = await lxdRequest(`/1.0/instances/${encodeURIComponent(vm.name)}`, {
            method: 'PATCH',
            body: { config: { ...instance.config, 'user.hanasand.always_running': value, 'boot.autostart': value } },
        })
        if (operation.operation) await lxdRequest(operation.operation + '/wait?timeout=90')
    }
    // Read the actual state; the dashboard's cached status may be stale.
    if (enabled) await setLocalLxdInstanceState(vm.name, 'start', { tolerateAlready: true })
}

export default async function ensureAlwaysRunningVms() {
    const result = await run(`
        SELECT name, primary_host FROM vms
        WHERE deleted_at IS NULL AND always_running_enabled IS TRUE AND always_running_premium IS TRUE
          AND LOWER(primary_host) = LOWER($1)
    `, [config.vm_host_id])
    const failures: string[] = []
    for (const vm of result.rows) {
        try {
            await vmLifecycleLock(vm.name, () => applyAlwaysRunning(vm as AlwaysRunningVm, true))
        } catch (error) {
            failures.push(`${vm.name}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
    if (failures.length) throw new Error(`Always-running checks failed: ${failures.join('; ')}`)
}
