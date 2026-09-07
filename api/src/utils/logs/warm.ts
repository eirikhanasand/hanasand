import { loadLogs, loadLogServices } from '../../handlers/logs/get.ts'
import { loadErrorEvents } from '../../handlers/logs/errors.ts'

export async function warmLogSnapshots() {
    const results = await Promise.allSettled([
        loadLogs({ level: 'error', limit: '500' }),
        loadLogServices(),
        loadErrorEvents({ limit: '150' }),
    ])
    if (results.some(result => result.status === 'rejected')) {
        console.warn('Some log snapshots could not be warmed; subsequent refreshes will retry.')
    }
}

export function refreshLogSnapshots() {
    const timer = setInterval(() => { void warmLogSnapshots() }, 5000)
    timer.unref()
    return () => clearInterval(timer)
}
