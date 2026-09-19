import getStatus, { type ServiceStatus } from './getStatus'
import { retainVerifiedStatus, toPublicServiceStatus } from './publicStatus'

// Refresh away from the rendering path. Failures retain the actual last result.
const snapshots = new Map<string, { value?: ServiceStatus, nextRefresh: number, pending?: Promise<ServiceStatus> }>()
export default async function getPublicStatus({ incidentId, summary = false, dashboard = false }: { incidentId?: string, summary?: boolean, dashboard?: boolean } = {}) {
    if (incidentId) return toPublicServiceStatus(await getStatus({ incidentId }))
    const key = summary ? 'summary' : dashboard ? 'dashboard' : 'history'
    let entry = snapshots.get(key)
    if (!entry) { entry = { nextRefresh: 0 }; snapshots.set(key, entry) }
    const state = entry
    if (!state.pending && Date.now() >= state.nextRefresh) {
        state.nextRefresh = Date.now() + 3000
        state.pending = getStatus({ summary, dashboard }).then(raw => {
            const next = toPublicServiceStatus(raw)
            state.value = retainVerifiedStatus(next, state.value)
            return state.value
        }).finally(() => { state.pending = undefined })
    }
    if (state.value) return state.value
    return state.pending!
}
