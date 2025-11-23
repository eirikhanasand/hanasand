import config from '@/config'

export default async function fetchArticle(id: string): Promise<Article | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/article/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            if (response.status === 404) {
                return null
            }

            throw new Error('This page does not exist.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
