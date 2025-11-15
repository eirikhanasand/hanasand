import config from '@/config'

export default async function getDockerContainers(): Promise<DockerContainer[]> {
    try {
        const response = await fetch(`${config.url.cdn}/docker/containers`)
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
