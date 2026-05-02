import config from '@/config'
import getShareHeaders from '@/utils/share/getHeaders'

type GetProjectProps = {
    alias: string
    token?: string
    userId?: string
}

type ProjectWorkspace = {
    tree: Tree
    share: Share
}

export default async function getProject({ alias, token, userId }: GetProjectProps): Promise<ProjectWorkspace | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(config.abortTimeout, 10000))

    try {
        const response = await fetch(`${config.url.cdn}/project/${alias}`, {
            headers: getShareHeaders(token, userId),
            signal: controller.signal,
        })

        clearTimeout(timeout)
        if (!response.ok) {
            return null
        }

        const data = await response.json()
        if (!data || !Array.isArray(data.tree) || !data.share) {
            return null
        }

        return data
    } catch (error) {
        console.error(`Failed to fetch project ${alias}: ${error}`)
        return null
    }
}
