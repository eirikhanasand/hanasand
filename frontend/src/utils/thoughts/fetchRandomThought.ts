import config from '@/config'

export default async function fetchRandomThought(): Promise<Thought | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/thought/random`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Failed to fetch random thought.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
