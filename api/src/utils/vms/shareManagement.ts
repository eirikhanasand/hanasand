import run from '#db'
import { lxdRequest } from './lxd.ts'

type Instance = { name: string; config?: Record<string, string> }

export function shareManagedNames(aliases: string[], instances: Instance[]) {
    const shares = new Set(aliases.filter(Boolean))
    return new Set(instances.filter(vm => shares.has(vm.name) || shares.has(vm.config?.['user.hanasand.claimed_name'] || '')).map(vm => vm.name))
}

export async function withShareManagement<T extends { name: string }>(vms: T[]) {
    const result = await run('SELECT DISTINCT alias FROM share WHERE alias <> \'\'')
    const aliases = result.rows.map(row => row.alias as string)
    let instances: Instance[] = vms
    if (aliases.length && vms.some(vm => !aliases.includes(vm.name))) {
        // Warm-pool VMs keep their original name after assignment to a share.
        try {
            instances = (await lxdRequest<Instance[]>('/1.0/instances?recursion=1', { timeout: 1500 })).metadata
        } catch { /* A missing host must not prevent the VM inventory from loading. */ }
    }
    const managed = shareManagedNames(aliases, [...vms, ...instances])
    return vms.map(vm => ({ ...vm, managed: managed.has(vm.name) }))
}
