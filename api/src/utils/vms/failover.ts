import { randomUUID } from 'node:crypto'
import run from '#db'
import { vmLifecycleLock } from './lifecycleLock.ts'
import { hostJson, inspectHostVm, internalHostFetch, otherHost, type HostInstance } from './hostTransport.ts'

export async function ensureFailoverSchema() {
    await run(`CREATE TABLE IF NOT EXISTS vm_failover (
        vm_name TEXT PRIMARY KEY REFERENCES vms(name) ON UPDATE CASCADE ON DELETE CASCADE,
        replica_id UUID NOT NULL, phase TEXT NOT NULL DEFAULT 'queued', target_host TEXT NOT NULL,
        requested_host TEXT, request_id UUID, synced_at TIMESTAMPTZ, error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}
export function portableContainer(instance: HostInstance) {
    return instance.type === 'container' && !instance.ephemeral && !instance.config['user.hanasand.delete_after']
        && !Object.keys(instance.config).some(key => key.startsWith('raw.') || key === 'security.privileged' && instance.config[key] === 'true')
        && Object.values(instance.expanded_devices).every(device => device.type === 'disk' && device.path === '/' && !device.source
            || device.type === 'nic' && (device.network === 'lxdbr0' || device.parent === 'lxdbr0'))
}
export async function assertFailoverAvailable(vm: { name: string; primary_host: string }) {
    const target = otherHost(vm.primary_host)
    if (!target) throw new Error('This container host does not support failover.')
    const source = await inspectHostVm(vm.primary_host, vm.name)
    if (!portableContainer(source.instance)) throw new Error('Failover requires a persistent container without attached host disks or custom host devices.')
    await hostJson(target, vm.name, '/resilience-eligibility')
    return target
}
export async function enableFailover(vm: { name: string; primary_host: string }) {
    const target = await assertFailoverAvailable(vm)
    await run(`INSERT INTO vm_failover(vm_name, replica_id, target_host) VALUES($1,$2,$3)
        ON CONFLICT(vm_name) DO UPDATE SET phase = 'queued', error = NULL, updated_at = NOW()
        WHERE vm_failover.requested_host IS NULL`, [vm.name, randomUUID(), target])
    return target
}
export async function requestFailover(vm: { name: string; primary_host: string; failover_host: string | null }, target: unknown, requestId: unknown) {
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) || typeof target !== 'string') throw new Error('Invalid failover request.')
    const current = (await run('SELECT * FROM vm_failover WHERE vm_name = $1', [vm.name])).rows[0]
    if (current?.request_id === requestId) return
    if (target !== vm.failover_host || target !== otherHost(vm.primary_host)) throw new Error('The selected standby host has changed. Refresh the container first.')
    if (!current?.synced_at || current.phase !== 'ready') throw new Error('Wait until the standby copy is ready before switching hosts.')
    await run('UPDATE vm_failover SET phase = \'switch-queued\', requested_host = $2, request_id = $3, error = NULL, updated_at = NOW() WHERE vm_name = $1', [vm.name, target, requestId])
}
async function copy(name: string, source: string, target: string, id: string) {
    const stagingName = 'fo-' + randomUUID().replaceAll('-', '')
    const archive = await internalHostFetch(source, '/vm/' + encodeURIComponent(name) + '/resilience-export', { headers: { 'x-replica-id': id } })
    if (!archive.ok || !archive.body) { await archive.body?.cancel(); throw new Error('The source host could not export this container.') }
    try {
        const result = await internalHostFetch(target, '/vm/' + stagingName + '/resilience-import', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-replica-id': id }, body: archive.body,
        })
        const body = await result.json()
        if (!result.ok) throw new Error(body.error || 'The standby disk could not be imported.')
        await hostJson(target, name, '/resilience-install', { replicaId: id, stagingName })
    } catch (error) {
        await archive.body.cancel().catch(() => {})
        // This name is unique to this attempt; the host also verifies its identity and stopped state.
        await hostJson(target, stagingName, '/resilience/remove-copy', { replicaId: id }).catch(() => {})
        throw error
    }
}
export async function processVmFailover(name: string) {
    return vmLifecycleLock(name, async () => {
        const vm = (await run('SELECT * FROM vms WHERE name = $1', [name])).rows[0]
        const job = (await run('SELECT * FROM vm_failover WHERE vm_name = $1', [name])).rows[0]
        if (!vm || !job || vm.deleted_at) return
        if (!vm.failover_enabled || !vm.failover_premium) return
        const source = vm.primary_host
        const target = job.requested_host || otherHost(source)
        if (!target || source === target) throw new Error('Invalid failover host pair.')
        const id = job.replica_id
        const switching = Boolean(job.requested_host)
        await run('UPDATE vm_failover SET phase = $2, error = NULL, updated_at = NOW() WHERE vm_name = $1', [name, switching ? 'switching' : 'copying'])
        try {
            if (switching) {
                // A restarted worker may find promotion succeeded before the DB acknowledgement.
                const [original, standby] = await Promise.all([inspectHostVm(source, name), inspectHostVm(target, name)])
                if (original.instance.config['user.hanasand.failover_id'] !== id || standby.instance.config['user.hanasand.failover_id'] !== id) throw new Error('Failover copy identity changed.')
                if (standby.instance.status === 'Running') {
                    if (original.instance.status !== 'Stopped' || standby.instance.config['user.hanasand.failover_role'] !== 'active') throw new Error('Cannot safely confirm which container is active.')
                } else {
                    await hostJson(source, name, '/resilience/demote', { replicaId: id })
                    // Final copy after stopping includes every completed write.
                    await copy(name, source, target, id)
                    if ((await inspectHostVm(source, name)).instance.status !== 'Stopped') throw new Error('The original container has not stopped.')
                    try { await hostJson(target, name, '/resilience/promote', { replicaId: id }) }
                    catch (error) {
                        // Restart the original only after the target is positively confirmed stopped.
                        const current = await inspectHostVm(target, name)
                        if (current.instance.status === 'Stopped') await hostJson(source, name, '/resilience/promote', { replicaId: id })
                        throw error
                    }
                }
                const verified = await inspectHostVm(target, name)
                if (verified.instance.status !== 'Running') throw new Error('Standby promotion was not confirmed.')
                await run('UPDATE vms SET primary_host = $2, failover_host = $3 WHERE name = $1 AND deleted_at IS NULL', [name, target, source])
                await run('UPDATE vm_failover SET phase = \'ready\', target_host = $2, requested_host = NULL, synced_at = NOW(), error = NULL, updated_at = NOW() WHERE vm_name = $1', [name, source])
                if (vm.always_running_enabled && vm.always_running_premium) await hostJson(target, name, '/resilience/policy', { enabled: true })
            } else {
                await hostJson(source, name, '/resilience/prepare', { replicaId: id })
                await copy(name, source, target, id)
                await run('UPDATE vm_failover SET phase = \'ready\', target_host = $2, synced_at = NOW(), error = NULL, updated_at = NOW() WHERE vm_name = $1', [name, target])
            }
        } catch (error) {
            if (switching) {
                // Never infer that an unreachable target is stopped.
                try {
                    const active = (await run('SELECT primary_host FROM vms WHERE name = $1', [name])).rows[0]
                    const standby = await inspectHostVm(target, name)
                    if (active?.primary_host === source && standby.instance.status === 'Stopped') {
                        await hostJson(source, name, '/resilience/promote', { replicaId: id })
                    }
                } catch { /* Leave both identities unchanged until their state can be verified. */ }
            }
            await run('UPDATE vm_failover SET phase = \'error\', error = $2, updated_at = NOW() WHERE vm_name = $1', [name, error instanceof Error ? error.message : 'Container transfer failed.'])
            throw error
        }
    })
}
export async function maintainVmFailover() {
    const jobs = await run(`SELECT f.vm_name FROM vm_failover f JOIN vms v ON v.name = f.vm_name
        WHERE v.deleted_at IS NULL AND v.failover_enabled AND v.failover_premium
        AND (f.phase <> 'ready' OR f.synced_at < NOW() - INTERVAL '15 minutes')
        ORDER BY (f.requested_host IS NOT NULL) DESC, f.updated_at LIMIT 5`)
    const failed: string[] = []
    for (const job of jobs.rows) {
        try { await processVmFailover(job.vm_name) } catch { failed.push(job.vm_name) }
    }
    if (failed.length) throw new Error('Failover needs attention for: ' + failed.join(', '))
}
