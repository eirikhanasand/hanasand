import config from '@/config'

export default async function getVMMetrics(id: string): Promise<VMMetrics[]> {
    try {
        const response = await fetch(`${config.url.cdn}/vm/metrics/${id}`)
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
