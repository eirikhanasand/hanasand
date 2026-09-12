import config from '#constants'
import run from '#db'
import { vmLifecycleLock } from './lifecycleLock.ts'
import { getLocalLxdInstance, lxdRequest, setLocalLxdInstanceState } from './lxd.ts'

export const deletionMarker = 'user.hanasand.delete_after'
const fail = (message: string, statusCode = 409): never => { throw Object.assign(new Error(message), { statusCode }) }

type DeletedVm = {
    name: string; primary_host: string; deleted_at: string | null; delete_after: string | null
    deletion_restore: { running: boolean; autostart: string | null; ephemeral: boolean } | null
}

async function load(name: string) {
    const vm = (await run('SELECT * FROM vms WHERE name = $1', [name])).rows[0] as DeletedVm | undefined
    if (!vm) return fail('VM not found.', 404)
    if (vm.primary_host.toLowerCase() !== config.vm_host_id.toLowerCase()) return fail('Connect to the VM’s primary host to manage deletion.')
    return vm
}

async function finish(operation?: string) {
    if (!operation) return
    const result = await lxdRequest<{ status_code?: number; err?: string }>(operation + '/wait?timeout=90')
    if (result.metadata.err || result.metadata.status_code !== 200) throw new Error(result.metadata.err || 'VM operation did not complete.')
}

async function quarantine(vm: DeletedVm) {
    const instance = await getLocalLxdInstance(vm.name)
    // An ephemeral instance would otherwise destroy its disk as soon as it stops.
    if (instance.ephemeral || instance.config?.['boot.autostart'] !== 'false' || instance.config?.[deletionMarker] !== String(vm.delete_after)) {
        const result = await lxdRequest(`/1.0/instances/${encodeURIComponent(vm.name)}`, {
            method: 'PATCH', body: { ephemeral: false, config: { ...instance.config, 'boot.autostart': 'false', [deletionMarker]: String(vm.delete_after) } },
        })
        await finish(result.operation)
    }
    await setLocalLxdInstanceState(vm.name, 'stop', { tolerateAlready: true })
    if ((await getLocalLxdInstance(vm.name)).status?.toLowerCase() !== 'stopped') throw new Error('VM has not stopped yet.')
}

async function recordFailure(name: string, error: unknown) {
    await run('UPDATE vms SET deletion_error = $2 WHERE name = $1 AND deleted_at IS NOT NULL', [name, error instanceof Error ? error.message : 'VM operation failed.'])
}

export async function scheduleVmDeletion(name: string, confirmation: unknown) {
    if (confirmation !== name) return fail('Type the exact VM name to confirm deletion.', 400)
    return vmLifecycleLock(name, async () => {
        let vm = await load(name)
        if (!vm.deleted_at) {
            const instance = await getLocalLxdInstance(name)
            const saved = { running: instance.status?.toLowerCase() === 'running', autostart: instance.config?.['boot.autostart'] ?? null, ephemeral: instance.ephemeral ?? false }
            vm = (await run('UPDATE vms SET deleted_at = NOW(), delete_after = NOW() + INTERVAL \'30 days\', deletion_restore = $2::jsonb, deletion_error = NULL WHERE name = $1 RETURNING *', [name, JSON.stringify(saved)])).rows[0]
        }
        try {
            await quarantine(vm)
            return (await run('UPDATE vms SET deletion_error = NULL WHERE name = $1 RETURNING *', [name])).rows[0]
        } catch (error) { await recordFailure(name, error); throw error }
    })
}

export async function restoreVm(name: string) {
    return vmLifecycleLock(name, async () => {
        const vm = await load(name)
        if (!vm.deleted_at) return vm
        const eligible = await run('SELECT name FROM vms WHERE name = $1 AND delete_after > NOW()', [name])
        if (!eligible.rows.length) return fail('The 30-day recovery period has ended.', 410)
        if (!vm.deletion_restore) return fail('The saved VM configuration is missing.')
        try {
            const instance = await getLocalLxdInstance(name)
            const config = { ...instance.config, 'boot.autostart': vm.deletion_restore.autostart ?? '', [deletionMarker]: '' }
            await finish((await lxdRequest(`/1.0/instances/${encodeURIComponent(name)}`, { method: 'PATCH', body: { config } })).operation)
            if (vm.deletion_restore.running) await setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
            await finish((await lxdRequest(`/1.0/instances/${encodeURIComponent(name)}`, { method: 'PATCH', body: { ephemeral: vm.deletion_restore.ephemeral } })).operation)
            return (await run('UPDATE vms SET deleted_at = NULL, delete_after = NULL, deletion_restore = NULL, deletion_error = NULL WHERE name = $1 RETURNING *', [name])).rows[0]
        } catch (error) {
            await quarantine(vm).catch(() => {})
            await recordFailure(name, error)
            throw error
        }
    })
}

export async function maintainDeletedVms() {
    const pending = await run('SELECT name FROM vms WHERE deleted_at IS NOT NULL AND LOWER(primary_host) = LOWER($1)', [config.vm_host_id])
    const failures: string[] = []
    for (const { name } of pending.rows) {
        try {
            await vmLifecycleLock(name, async () => {
                const vm = await load(name)
                if (!vm.deleted_at) return
                const expired = await run('SELECT name FROM vms WHERE name = $1 AND delete_after <= NOW()', [name])
                if (!expired.rows.length) { await quarantine(vm); await run('UPDATE vms SET deletion_error = NULL WHERE name = $1', [name]); return }
                // Listing distinguishes an already-purged instance from a host/network failure.
                const instances = await lxdRequest<Array<{ name: string }>>('/1.0/instances?recursion=1')
                if (instances.metadata.some(instance => instance.name === name)) {
                    await quarantine(vm)
                    await finish((await lxdRequest(`/1.0/instances/${encodeURIComponent(name)}`, { method: 'DELETE' })).operation)
                    const remaining = await lxdRequest<Array<{ name: string }>>('/1.0/instances?recursion=1')
                    if (remaining.metadata.some(instance => instance.name === name)) throw new Error('VM disk deletion did not complete.')
                }
                await run('DELETE FROM vm_shutdown WHERE name = $1', [name])
                await run('DELETE FROM vms WHERE name = $1 AND delete_after <= NOW()', [name])
            })
        } catch (error) { await recordFailure(name, error); failures.push(name) }
    }
    if (failures.length) throw new Error(`Could not finish VM deletion for: ${failures.join(', ')}`)
}
