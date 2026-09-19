export async function prepareVmConsole(name: string, api: string, id: string, token: string, status: (message: string) => void, signal: AbortSignal, request: typeof fetch = fetch) {
    const headers = { id, Authorization: `Bearer ${token}` }
    status('Checking container…')
    const details = await request(`${api}/vm/details/${encodeURIComponent(name)}?refresh=1`, { headers, cache: 'no-store', signal })
    if (!details.ok) throw new Error('Unable to check container status.')
    const vm = await details.json()
    if (String(vm.status).toLowerCase() === 'stopped') {
        status('Starting container…')
        const result = await request(`${api}/vm/${encodeURIComponent(name)}/start`, { method: 'POST', headers, signal })
        if (!result.ok) {
            const error = await result.json().catch(() => null)
            throw new Error(error?.error || 'Unable to start container.')
        }
        status('Container started. Opening console…')
    }
}
