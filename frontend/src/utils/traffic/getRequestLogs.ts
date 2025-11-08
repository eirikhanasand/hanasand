import config from '@/config'

interface RequestLog {
    metric: string
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

interface GetRequestLogsOptions {
    limit?: number
    sort?: 'hits' | 'timestamp'
}

export default async function getRequestLogs(options: GetRequestLogsOptions = {}): Promise<RequestLog[]> {
    const { limit = 100, sort = 'timestamp' } = options

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2000)

        const url = new URL(`${config.url.cdn}/traffic/recent`)
        url.searchParams.append('limit', String(limit))
        if (sort === 'hits') url.searchParams.append('sort', 'hits')

        const response = await fetch(url.toString(), {
            cache: 'no-store',
            signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
            throw new Error(`Failed to fetch request logs: ${response.statusText}`)
        }

        const data: RequestLog[] = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching request logs:', error)
        return []
    }
}
