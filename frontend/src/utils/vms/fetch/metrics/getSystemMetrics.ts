import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

type SystemMetricsProps = {
    id: string
    token: string
}

export default async function getSystemMetrics({ id, token }: SystemMetricsProps): Promise<SystemMetricsApiResponse> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await responseErrorMessage(response, 'System telemetry'))
        }

        const raw = await response.json()
        const data = (raw?.data ?? raw) as SystemMetricsApiResponse
        return {
            system: data.system ?? null,
            unavailable_reason: data.unavailable_reason,
            generated_at: data.generated_at ?? new Date().toISOString(),
        }
    } catch (error) {
        return {
            system: null,
            unavailable_reason: error instanceof Error ? error.message : 'System telemetry is unavailable.',
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
