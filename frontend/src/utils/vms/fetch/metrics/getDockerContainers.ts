import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

type DockerContainerStats = {
    id: string
    token: string
}

export default async function getDockerContainers({ id, token }: DockerContainerStats): Promise<DockerTelemetryResponse> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/docker`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await responseErrorMessage(response, 'Docker telemetry'))
        }

        const data = await response.json()
        if (Array.isArray(data)) {
            return { containers: data as DockerContainer[], source: 'legacy_array', generated_at: new Date().toISOString() }
        }

        const payload = data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
            ? data.data
            : data
        const containers = Array.isArray(payload?.containers)
            ? payload.containers
            : Array.isArray(data?.data)
                ? data.data
                : []

        return {
            containers: containers as DockerContainer[],
            source: typeof payload?.source === 'string' ? payload.source : undefined,
            docker_socket_available: typeof payload?.docker_socket_available === 'boolean' ? payload.docker_socket_available : undefined,
            unavailable_reason: typeof payload?.unavailable_reason === 'string' ? payload.unavailable_reason : undefined,
            generated_at: typeof payload?.generated_at === 'string' ? payload.generated_at : new Date().toISOString(),
        }
    } catch (error) {
        return {
            containers: [],
            source: 'unavailable',
            unavailable_reason: error instanceof Error ? error.message : 'Docker telemetry is unavailable.',
            generated_at: new Date().toISOString(),
        }
    }
}

async function responseErrorMessage(response: Response, label: string) {
    const body = await response.text().catch(() => '')
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        const message = typeof parsed.error === 'string'
            ? parsed.error
            : typeof parsed.message === 'string'
                ? parsed.message
                : ''
        if (message) return `${label} returned ${response.status}: ${message}`
    } catch {
        // Plain text response bodies fall through.
    }

    return body.trim()
        ? `${label} returned ${response.status}: ${body.trim().slice(0, 300)}`
        : `${label} returned ${response.status}.`
}
