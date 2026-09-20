import config from '@/config'

type SystemSnapshotResponse = {
    systemTelemetry: SystemMetricsApiResponse
    dockerTelemetry: DockerTelemetryResponse
    vms: VM[]
    vmMetrics: VMMetrics[]
}

export default async function getSystemSnapshot(id: string, token: string): Promise<SystemSnapshotResponse> {
    const response = await fetch(`${config.url.api}/system/snapshot`, {
        headers: { id, Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) throw new Error('System telemetry is unavailable. Please retry.')
    return response.json()
}
