import { readFile } from 'node:fs/promises'
import { canViewHostMetrics } from '@/utils/vms/hostAccess'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export async function GET() {
    try {
        const response = await fetch(process.env.RESILIENCE_STATUS_URL || 'https://api.hanasand.com/api/resilience/status', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
        const state = await response.json()
        delete state.compute
        delete state.sites
        delete state.replicaEligibility
        if (process.env.RESILIENCE_STATE_FILE && await canViewHostMetrics()) {
            try {
                const privateState = JSON.parse(await readFile(process.env.RESILIENCE_STATE_FILE, 'utf8'))
                const age = Date.now() - Date.parse(privateState.updatedAt)
                if (Number.isFinite(age) && age >= -5000 && age < 60000) {
                    state.compute = privateState.compute
                    state.sites = privateState.sites
                    state.replicaEligibility = privateState.replicaEligibility
                }
            } catch { /* Public service availability remains usable without host telemetry. */ }
        }
        return NextResponse.json(state, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ mode: 'unknown', readOnly: true, services: [], reason: 'Service status is reconnecting.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
}
