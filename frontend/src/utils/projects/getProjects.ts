import config from '@/config'

type GetProjectProps = {
    id: string
    token: string
}

export default async function getProjects({ id, token }: GetProjectProps): Promise<Thought[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/project/user/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Failed to fetch projects for ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
