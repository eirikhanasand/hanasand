import config from '@/config'

type SystemMetricsProps = {
    id: string
    token: string
}

export default async function getSystemMetrics({ id, token }: SystemMetricsProps): Promise<SystemSnapshot | null> {
    try {
        const response = await fetch(`${config.url.api}/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = (await response.json()) as SystemMetricsApiResponse
        return data.system ?? null
    } catch (error) {
        console.log(error)
        return null
    }
}
