import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export async function GET() {
    try {
        const response = await fetch(process.env.STATUS_URL || 'https://api.hanasand.com/api/status?dashboard=true', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
        const status = await response.json() as { overall?: string; generated_at?: string; checks?: Array<{ service?: string; check_name?: string; status?: string; message?: string }> }
        const checks = Array.isArray(status.checks) ? status.checks : []
        const state = {
            mode: response.ok && status.overall === 'up' ? 'normal' : 'unknown',
            readOnly: false,
            stale: !response.ok,
            updatedAt: status.generated_at,
            services: checks.map(check => ({
                id: check.service || 'service',
                name: check.check_name || check.service || 'Service',
                activeInstance: null,
                activeSite: null,
                activeEndpoint: null,
                status: check.status === 'up' ? 'available' : 'unavailable',
                instances: [{ id: check.service || 'service', site: 'primary', healthy: check.status === 'up' }],
            })),
        }
        return NextResponse.json(state, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ mode: 'unknown', readOnly: true, services: [], reason: 'Service status is reconnecting.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
}
