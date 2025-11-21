import config from '@/config'

export default async function getVMMetrics(id: string, token: string, userId: string): Promise<VMMetrics[]> {
    try {
        const response = await fetch(`${config.url.api}/vm/metrics/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data: VMMetrics[] = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
