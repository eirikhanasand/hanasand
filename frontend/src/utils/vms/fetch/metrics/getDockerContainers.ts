import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

type DockerContainerStats = {
    id: string
    token: string
}

export default async function getDockerContainers({ id, token }: DockerContainerStats): Promise<DockerContainer[]> {
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
            throw new Error(await response.text())
        }

        const data = await response.json()
        const containers = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.containers)
                    ? data.containers
                    : []

        return containers as DockerContainer[]
    } catch (error) {
        console.log(error)
        return []
    }
}
