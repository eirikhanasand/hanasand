import { readFileSync } from 'node:fs'
import type { JsonRule } from './jsonMonitoring.ts'

type Slot = { slot: string, walStatus: string, active: boolean, lagBytes: number | null, lagSince?: number | null }
type State = {
    sampledAt: number
    database?: { slots?: Slot[] }
    backups?: { restoreSlots?: string[] }
    backupReceipt?: { receivedAt?: string }
    backupJob?: { status?: string }
    services?: Array<{ id: string, name: string, status: string, activeInstance: string | null }>
    dns?: Record<string, { activeSite?: string } | string | undefined>
}
type Check = { failed: boolean, message: string }

export function recoveryChecks(state: State, now = Date.now()): Record<string, Check> {
    const age = now - state.sampledAt * 1000
    if (!Number.isFinite(age) || age > 60_000 || age < -5000) throw new Error('Recovery monitoring is unavailable.')
    const checks: Record<string, Check> = {}
    for (const [id, slotName, label] of [
        ['inspur_replica', 'hanasand_inspur_standby', 'Inspur'],
        ['ovh_replica', 'hanasand_ovh_standby', 'OVH'],
    ]) {
        const slot = state.database?.slots?.find(item => item.slot === slotName)
        const lost = slot?.walStatus === 'lost' || state.backups?.restoreSlots?.includes(slotName)
        const lag = slot?.lagBytes
        const validLag = typeof lag === 'number' && Number.isFinite(lag) && lag >= 0
        const healthy = !!slot?.active && validLag && lag <= 1048576 && !lost
        const lagAge = typeof slot?.lagSince === 'number' ? now - slot.lagSince * 1000 : NaN
        // Fail unavailable/lost replication immediately. Only brief, measured lag gets a grace period.
        const catchingUp = !!slot?.active && validLag && !lost && lagAge >= 0 && lagAge < 60_000
        checks[id] = { failed: !healthy && !catchingUp, message: lost ? 'WAL replication lost. Restore the replica from a backup.'
            : healthy ? `${label} replica is up to date.` : catchingUp ? `${label} replica is catching up.` : `${label} replica is not up to date.` }
    }
    const backupAge = now - Date.parse(state.backupReceipt?.receivedAt || '')
    const overdue = !Number.isFinite(backupAge) || backupAge > 36 * 3600_000 || backupAge < -5000
    const backupFailed = state.backupJob?.status !== 'verified'
    checks.backup = { failed: overdue || backupFailed, message: overdue ? 'No backup taken in 36 hours.'
        : backupFailed ? 'The latest backup failed.' : 'Backup completed.' }
    for (const id of ['frontend', 'api', 'auth', 'intelligence', 'database']) {
        const service = state.services?.find(item => item.id === id)
        checks[id] = { failed: service?.status !== 'up', message: !service ? `${id} status is unavailable.`
            : service.status === 'up' ? `${service.name} is back to normal.`
                : service.activeInstance ? `${service.name} is using ${service.activeInstance}. The primary is unavailable.`
                    : `${service.name} is unavailable.` }
    }
    const dnsError = state.dns?.status === 'error'
    const dnsFailed = dnsError || Object.values(state.dns || {}).some(item => typeof item === 'object' && item?.activeSite === 'ovhcloud')
    checks.dns = { failed: dnsFailed, message: dnsError ? 'Cannot check public traffic routing.' : dnsFailed ? 'Public traffic is using OVH.' : 'Public traffic routing is normal.' }
    return checks
}

export function readRecoveryChecks() {
    let state: State
    try { state = JSON.parse(readFileSync(process.env.RECOVERY_MONITOR_STATE_FILE || '/recovery/state.json', 'utf8')) }
    catch { throw new Error('Recovery monitoring is unavailable.') }
    return recoveryChecks(state)
}

export function recoveryCheckMessage(payload: unknown, rule: JsonRule, inverted: boolean) {
    if (inverted || rule.operator !== 'eq' || rule.value !== true || rule.aggregate !== 'first' || !/^\w+\.failed$/.test(rule.path)) return null
    const check = (payload as Record<string, Check>)[rule.path.split('.')[0]]
    return typeof check?.message === 'string' ? check.message : null
}
