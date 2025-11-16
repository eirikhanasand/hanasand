import config from '@/config'

export default async function fetchThoughts(): Promise<Thought[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/thoughts`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch thoughts.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}