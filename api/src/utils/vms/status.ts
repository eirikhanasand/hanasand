import config from '#constants'

type Vm = { name: string; status?: string; last_checked?: string | Date | null }
type State = { status: string }
const checks = new Map<string, { expires: number; result: Promise<State> }>()

async function probe(name: string): Promise<State> {
    const cached = checks.get(name)
    if (cached && cached.expires > Date.now()) return cached.result
    const result = (async () => {
        const options: RequestInit & { unix: string } = {
            unix: config.lxd_socket_path,
            signal: AbortSignal.timeout(1500),
        }
        const response = await fetch(`http://localhost/1.0/instances/${encodeURIComponent(name)}/state`, options)
        if (!response.ok) throw new Error(response.status === 404 ? 'VM is unavailable on its host.' : 'VM host is not responding.')
        const body = await response.json() as { metadata?: State }
        if (!body.metadata?.status) throw new Error('VM host did not report a state.')
        return body.metadata
    })()
    if (checks.size >= 512) checks.delete(checks.keys().next().value!)
    checks.set(name, { expires: Date.now() + 5000, result })
    return result
}

export async function withLiveVmStatus<T extends Vm>(vm: T, check: (name: string) => Promise<State> = probe) {
    const status_checked_at = new Date().toISOString()
    try {
        const state = await check(vm.name)
        return { ...vm, status: state.status.toUpperCase(), status_reason: state.status === 'Running' ? '' : `VM is ${state.status.toLowerCase()}.`, status_checked_at }
    } catch {
        return { ...vm, status: 'OFFLINE', status_reason: 'Cannot reach this VM on its host.', status_checked_at }
    }
}
