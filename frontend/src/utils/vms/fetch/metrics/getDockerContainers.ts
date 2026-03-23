import config from '@/config'

type DockerContainerStats = {
    id: string
    token: string
}

export default async function getDockerContainers({ id, token }: DockerContainerStats): Promise<DockerContainer[]> {
    try {
        const response = await fetch(`${config.url.api}/docker`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data: DockerContainer[] = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
